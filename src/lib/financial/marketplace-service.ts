import { randomUUID } from 'crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getConnection, query, queryOne } from '@/lib/db'
import { accounts } from './account-types'
import { getFinancialConfig } from './config'
import { FinancialError } from './errors'
import { LedgerService, type LedgerActor } from './ledger-service'
import {
  calculateBasisPoints,
  majorToMinor,
  minorFromDatabase,
  toSafeDatabaseInteger,
  type MinorAmount,
} from './money-value'
import { paymentRail, type PaystackGateway } from './paystack-gateway'
import type { PaymentRail, PaymentVerificationResult } from './payment-rail'
import { assertTransition, jobFundsTransitions, paymentIntentTransitions } from './state-machines'
import { createPayWithTransferCharge } from '@/lib/paystack'
import {
  assertMarketplacePaymentLink,
  assertMarketplaceProviderPayment,
  type MarketplacePaymentLink,
} from './payment-integrity'

type FeeRuleRow = RowDataPacket & {
  id: number
  fee_basis_points: number
  minimum_fee_kobo: string | number
  maximum_fee_kobo: string | number | null
}

type JobFundRow = RowDataPacket & {
  id: number
  booking_id: number
  quote_id: number | null
  client_uid: string
  artisan_uid: string
  expected_amount_kobo: string | number
  platform_fee_kobo: string | number
  locked_account_id: number
  status: keyof typeof jobFundsTransitions
  funded_transaction_id: number | null
  release_transaction_id: number | null
  refund_transaction_id: number | null
}

type PaymentIntentRow = RowDataPacket & {
  id: number
  internal_reference: string
  provider: string
  provider_reference: string | null
  booking_id: number
  quote_id: number
  job_fund_id: number
  client_uid: string
  customer_email: string
  amount_kobo: string | number
  currency: string
  initiated_request_id: string
  initiated_session_fingerprint: string
  status: keyof typeof paymentIntentTransitions
}

type MarketplacePaymentLinkRow = RowDataPacket & {
  intent_id: number
  intent_internal_reference: string
  intent_booking_id: number
  intent_job_fund_id: number
  intent_quote_id: number
  intent_client_uid: string
  intent_customer_email: string
  intent_amount_kobo: string | number
  intent_currency: string
  intent_provider: string
  intent_provider_reference: string | null
  intent_request_id: string
  intent_session_fingerprint: string
  job_fund_id: number
  job_fund_booking_id: number
  job_fund_quote_id: number
  job_fund_client_uid: string
  job_fund_artisan_uid: string
  job_fund_amount_kobo: string | number
  job_fund_currency: string
  quote_id: number
  quote_booking_id: number
  quote_artisan_uid: string
  quote_amount: string | number
  quote_status: string
  booking_id: number
  booking_client_uid: string
  booking_artisan_uid: string
  booking_amount: string | number
  booking_status: string
  account_payment_intent_id: number | null
  account_booking_id: number | null
  account_quote_id: number | null
  account_client_uid: string | null
  account_amount_kobo: string | number | null
  account_currency: string | null
  account_provider: string | null
  account_provider_reference: string | null
  account_status: string | null
}

export type JobFundingInitialization = {
  intentId: number
  jobFundId: number
  quoteId: number
  reference: string
  amountMinor: number
  requestId: string
  sessionFingerprint: string
}

export type WalletFundedJob = {
  jobFundId: number
  transactionId: number
  reference: string
  amountMinor: number
  platformFeeMinor: number
}

export type PayWithTransferAccount = {
  reference: string
  amountMinor: number
  bankName: string
  bankSlug: string
  accountName: string
  accountNumber: string
  expiresAt: string
}

type JobPayWithTransferInput = JobFundingInitialization & {
  customerEmail: string
  clientUid: string
  bookingId: number
}

const ledger = new LedgerService()

export function isMarketplaceFinanceEnabled(): boolean {
  const enabled = process.env.MARKETPLACE_FINANCE_V3_ENABLED === 'true'
  if (process.env.NODE_ENV === 'production' && !enabled) {
    throw new Error('Marketplace finance must be enabled in production')
  }
  if (enabled) getFinancialConfig()
  return enabled
}

export async function createJobFundingInTransaction(
  conn: PoolConnection,
  input: {
    bookingId: number
    quoteId: number
    clientUid: string
    artisanUid: string
    customerEmail: string
    amountMinor: MinorAmount
    actor: LedgerActor
    requestId: string
    sessionFingerprint: string
  }
): Promise<JobFundingInitialization> {
  if (input.amountMinor <= BigInt(0)) {
    throw new FinancialError('INVALID_AMOUNT', 'Job funding amount must be positive')
  }

  const lockedAccount = await ledger.ensureAccountInTransaction(
    conn,
    accounts.clientLockedJobFunds(input.bookingId)
  )
  const feeRule = await activeFeeRule(conn)
  const fee = calculateBasisPoints(input.amountMinor, Number(feeRule.fee_basis_points), {
    minimum: minorFromDatabase(feeRule.minimum_fee_kobo),
    maximum:
      feeRule.maximum_fee_kobo === null
        ? null
        : minorFromDatabase(feeRule.maximum_fee_kobo),
  })

  const [jobResult] = await conn.execute<ResultSetHeader>(
    `INSERT INTO job_funds (
       booking_id, quote_id, client_uid, artisan_uid, currency, expected_amount_kobo,
       locked_account_id, status, fee_rule_id, platform_fee_kobo,
       initiated_request_id, initiated_session_fingerprint
     ) VALUES (?, ?, ?, ?, 'NGN', ?, ?, 'awaiting_funding', ?, ?, ?, ?)`,
    [
      input.bookingId,
      input.quoteId,
      input.clientUid,
      input.artisanUid,
      input.amountMinor.toString(),
      lockedAccount.id,
      feeRule.id,
      fee.toString(),
      input.requestId,
      input.sessionFingerprint,
    ]
  )

  const reference = financialReference('job-pay')
  const [intentResult] = await conn.execute<ResultSetHeader>(
    `INSERT INTO marketplace_payment_intents (
       internal_reference, provider, booking_id, quote_id, job_fund_id, client_uid,
       customer_email, amount_kobo, currency, status, purpose,
       initiated_request_id, initiated_session_fingerprint, metadata
     ) VALUES (?, 'paystack', ?, ?, ?, ?, ?, ?, 'NGN', 'created', 'booking_funding', ?, ?, ?)`,
    [
      reference,
      input.bookingId,
      input.quoteId,
      jobResult.insertId,
      input.clientUid,
      input.customerEmail.toLowerCase(),
      input.amountMinor.toString(),
      input.requestId,
      input.sessionFingerprint,
      JSON.stringify({
        bookingId: input.bookingId,
        quoteId: input.quoteId,
        requestId: input.requestId,
        actor: input.actor,
      }),
    ]
  )

  await writeAudit(conn, {
    actor: input.actor,
    action: 'job_funding.created',
    resourceType: 'job_fund',
    resourceId: String(jobResult.insertId),
    reference,
    details: {
      bookingId: input.bookingId,
      quoteId: input.quoteId,
      amountMinor: input.amountMinor.toString(),
      feeRuleId: feeRule.id,
    },
  })

  return {
    intentId: intentResult.insertId,
    jobFundId: jobResult.insertId,
    quoteId: input.quoteId,
    reference,
    amountMinor: toSafeDatabaseInteger(input.amountMinor),
    requestId: input.requestId,
    sessionFingerprint: input.sessionFingerprint,
  }
}

export async function createWalletFundedJobInTransaction(
  conn: PoolConnection,
  input: {
    bookingId: number
    quoteId: number
    clientUid: string
    artisanUid: string
    amountMinor: MinorAmount
    actor: LedgerActor
    requestId: string
    sessionFingerprint: string
  }
): Promise<WalletFundedJob> {
  if (input.amountMinor <= BigInt(0)) {
    throw new FinancialError('INVALID_AMOUNT', 'Job funding amount must be positive')
  }

  const lockedAccount = await ledger.ensureAccountInTransaction(
    conn,
    accounts.clientLockedJobFunds(input.bookingId)
  )
  const feeRule = await activeFeeRule(conn)
  const fee = calculateBasisPoints(input.amountMinor, Number(feeRule.fee_basis_points), {
    minimum: minorFromDatabase(feeRule.minimum_fee_kobo),
    maximum:
      feeRule.maximum_fee_kobo === null
        ? null
        : minorFromDatabase(feeRule.maximum_fee_kobo),
  })

  const [jobResult] = await conn.execute<ResultSetHeader>(
    `INSERT INTO job_funds (
       booking_id, quote_id, client_uid, artisan_uid, currency, expected_amount_kobo,
       locked_account_id, status, fee_rule_id, platform_fee_kobo,
       initiated_request_id, initiated_session_fingerprint
     ) VALUES (?, ?, ?, ?, 'NGN', ?, ?, 'awaiting_funding', ?, ?, ?, ?)`,
    [
      input.bookingId,
      input.quoteId,
      input.clientUid,
      input.artisanUid,
      input.amountMinor.toString(),
      lockedAccount.id,
      feeRule.id,
      fee.toString(),
      input.requestId,
      input.sessionFingerprint,
    ]
  )

  const posted = await ledger.postInTransaction(conn, {
    idempotencyKey: `job-wallet-lock:${input.bookingId}`,
    transactionType: 'job_wallet_funds_locked',
    amountMinor: input.amountMinor,
    userUid: input.clientUid,
    bookingId: input.bookingId,
    description: `Wallet funds locked for booking #${input.bookingId}`,
    actor: input.actor,
    entries: [
      { account: accounts.clientAvailable(input.clientUid), deltaMinor: -input.amountMinor },
      { account: accounts.clientLockedJobFunds(input.bookingId), deltaMinor: input.amountMinor },
    ],
    metadata: {
      jobFundId: jobResult.insertId,
      quoteId: input.quoteId,
      artisanUid: input.artisanUid,
      feeMinor: fee.toString(),
      fundingSource: 'verified_client_wallet',
    },
    outbox: {
      eventType: 'job.funded',
      aggregateType: 'booking',
      aggregateId: String(input.bookingId),
      payload: {
        bookingId: input.bookingId,
        clientUid: input.clientUid,
        artisanUid: input.artisanUid,
        amountMinor: input.amountMinor.toString(),
      },
    },
  })

  await conn.execute(
    `UPDATE job_funds
     SET status = 'locked', funded_transaction_id = ?,
         funded_amount_kobo = expected_amount_kobo,
         locked_amount_kobo = expected_amount_kobo,
         funded_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [posted.id, jobResult.insertId]
  )
  await writeAudit(conn, {
    actor: input.actor,
    action: 'job_funding.locked_from_verified_wallet',
    resourceType: 'job_fund',
    resourceId: String(jobResult.insertId),
    reference: posted.reference,
    details: {
      bookingId: input.bookingId,
      amountMinor: input.amountMinor.toString(),
      platformFeeMinor: fee.toString(),
      fundingTransactionId: posted.id,
    },
  })

  return {
    jobFundId: jobResult.insertId,
    transactionId: posted.id,
    reference: posted.reference,
    amountMinor: toSafeDatabaseInteger(input.amountMinor),
    platformFeeMinor: toSafeDatabaseInteger(fee),
  }
}

export async function initializeJobPayment(
  input: JobFundingInitialization & {
    customerEmail: string
    clientUid: string
    bookingId: number
    callbackUrl: string
  },
  rail: PaymentRail = paymentRail
): Promise<{ authorizationUrl: string; reference: string }> {
  try {
    await validateMarketplacePaymentInitialization(input)
    const provider = await rail.initializePayment({
      email: input.customerEmail,
      amountMinor: input.amountMinor,
      currency: 'NGN',
      reference: input.reference,
      callbackUrl: input.callbackUrl,
      metadata: {
        type: 'booking_funding',
        bookingId: String(input.bookingId),
        clientUid: input.clientUid,
        paymentIntentId: String(input.intentId),
        quoteId: String(input.quoteId),
        requestId: input.requestId,
      },
    })
    if (provider.providerReference !== input.reference) {
      throw new FinancialError('NOT_AUTHORIZED', 'Paystack returned an unexpected payment reference', 502)
    }

    await updateInitializedPaymentIntent(input, provider.providerReference)
    return { authorizationUrl: provider.authorizationUrl, reference: input.reference }
  } catch (error) {
    await markPaymentInitializationFailed(input.intentId, safeError(error)).catch(() => undefined)
    throw error
  }
}

export async function createJobPaymentRetryInTransaction(
  conn: PoolConnection,
  input: {
    bookingId: number
    quoteId: number
    clientUid: string
    customerEmail: string
    actor: LedgerActor
    requestId: string
    sessionFingerprint: string
  }
): Promise<JobFundingInitialization> {
  const [fundRows] = await conn.execute<JobFundRow[]>(
    `SELECT * FROM job_funds WHERE booking_id = ? FOR UPDATE`,
    [input.bookingId]
  )
  const jobFund = fundRows[0]
  if (!jobFund) throw new FinancialError('NOT_FOUND', 'Booking payment record was not found', 404)
  if (jobFund.client_uid !== input.clientUid) {
    throw new FinancialError('NOT_AUTHORIZED', 'This payment belongs to another client', 403)
  }
  if (jobFund.quote_id !== input.quoteId) {
    throw new FinancialError('INVALID_STATE', 'The payment does not match the accepted quote.', 409)
  }
  if (!['awaiting_funding', 'funding_pending'].includes(jobFund.status)) {
    throw new FinancialError('INVALID_STATE', `Payment cannot be restarted from ${jobFund.status}`, 409)
  }

  const reference = financialReference('job-pwt')
  const [intentResult] = await conn.execute<ResultSetHeader>(
    `INSERT INTO marketplace_payment_intents (
       internal_reference, provider, booking_id, quote_id, job_fund_id, client_uid,
       customer_email, amount_kobo, currency, status, purpose,
       initiated_request_id, initiated_session_fingerprint, metadata
     ) VALUES (?, 'paystack', ?, ?, ?, ?, ?, ?, 'NGN', 'created', 'booking_funding', ?, ?, ?)`,
    [
      reference,
      input.bookingId,
      input.quoteId,
      jobFund.id,
      input.clientUid,
      input.customerEmail.toLowerCase(),
      String(jobFund.expected_amount_kobo),
      input.requestId,
      input.sessionFingerprint,
      JSON.stringify({
        bookingId: input.bookingId,
        quoteId: input.quoteId,
        requestId: input.requestId,
        actor: input.actor,
        retry: true,
      }),
    ]
  )

  return {
    intentId: intentResult.insertId,
    jobFundId: jobFund.id,
    quoteId: input.quoteId,
    reference,
    amountMinor: toSafeDatabaseInteger(minorFromDatabase(jobFund.expected_amount_kobo)),
    requestId: input.requestId,
    sessionFingerprint: input.sessionFingerprint,
  }
}

export async function initializeJobPayWithTransfer(
  input: JobPayWithTransferInput
): Promise<PayWithTransferAccount> {
  const expiryMinutes = Math.min(
    480,
    Math.max(15, Number.parseInt(process.env.PWT_ACCOUNT_EXPIRY_MINUTES || '60', 10) || 60)
  )
  const requestedExpiry = new Date(Date.now() + expiryMinutes * 60_000).toISOString()

  try {
    await validateMarketplacePaymentInitialization(input)
    const provider = await createPayWithTransferCharge({
      email: input.customerEmail,
      amountKobo: input.amountMinor,
      reference: input.reference,
      accountExpiresAt: requestedExpiry,
      metadata: {
        type: 'booking_funding',
        bookingId: String(input.bookingId),
        quoteId: String(input.quoteId),
        clientUid: input.clientUid,
        paymentIntentId: String(input.intentId),
        requestId: input.requestId,
      },
    })

    if (provider.data.status !== 'pending_bank_transfer') {
      throw new FinancialError('PROVIDER_UNAVAILABLE', 'Paystack did not return bank transfer details', 502)
    }
    if (provider.data.reference !== input.reference) {
      throw new FinancialError('NOT_AUTHORIZED', 'Paystack returned an unexpected payment reference', 502)
    }

    const conn = await getConnection()
    try {
      await conn.beginTransaction()
      const [intentRows] = await conn.execute<PaymentIntentRow[]>(
        `SELECT * FROM marketplace_payment_intents WHERE id = ? FOR UPDATE`,
        [input.intentId]
      )
      const intent = intentRows[0]
      if (!intent) throw new FinancialError('NOT_FOUND', 'Payment intent was not found', 404)
      if (intent.status !== 'created') {
        throw new FinancialError('INVALID_STATE', `Payment cannot be initialized from ${intent.status}`, 409)
      }
      const link = await loadMarketplacePaymentLink(conn, input.intentId)
      assertMarketplacePaymentLink(link, { requirePaymentAccount: false })
      assertInitializationMatches(link, input)

      await conn.execute(
        `INSERT INTO booking_payment_accounts (
           booking_id, quote_id, marketplace_payment_intent_id, client_uid,
           provider, provider_reference, amount_kobo, currency, bank_name,
           bank_slug, account_name, account_number, status, expires_at
         ) VALUES (?, ?, ?, ?, 'paystack', ?, ?, 'NGN', ?, ?, ?, ?, 'active', ?)`,
        [
          input.bookingId,
          input.quoteId,
          input.intentId,
          input.clientUid,
          provider.data.reference,
          input.amountMinor,
          provider.data.bank.name,
          provider.data.bank.slug,
          provider.data.account_name,
          provider.data.account_number,
          new Date(provider.data.account_expires_at),
        ]
      )
      await conn.execute(
        `UPDATE marketplace_payment_intents
         SET provider_reference = ?, payment_method = 'bank_transfer', status = 'initialized',
             initialized_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [provider.data.reference, input.intentId]
      )
      await conn.execute(
        `UPDATE job_funds SET status = 'funding_pending', updated_at = NOW()
         WHERE id = ? AND status = 'awaiting_funding'`,
        [input.jobFundId]
      )
      await conn.commit()
    } catch (error) {
      await conn.rollback().catch(() => undefined)
      throw error
    } finally {
      conn.release()
    }

    return {
      reference: provider.data.reference,
      amountMinor: input.amountMinor,
      bankName: provider.data.bank.name,
      bankSlug: provider.data.bank.slug,
      accountName: provider.data.account_name,
      accountNumber: provider.data.account_number,
      expiresAt: provider.data.account_expires_at,
    }
  } catch (error) {
    await markPaymentInitializationFailed(input.intentId, safeError(error)).catch(() => undefined)
    throw error
  }
}

export async function confirmExternalPayment(
  reference: string,
  actor: LedgerActor,
  rail: PaymentRail = paymentRail
): Promise<{ bookingId: number; credited: boolean }> {
  // Provider verification is deliberately outside the database transaction.
  const verified = await rail.verifyPayment(reference)
  validateProviderPayment(verified)

  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [intents] = await conn.execute<PaymentIntentRow[]>(
      `SELECT * FROM marketplace_payment_intents
       WHERE internal_reference = ? OR (provider = ? AND provider_reference = ?)
       LIMIT 1 FOR UPDATE`,
      [reference, verified.provider, verified.reference]
    )
    const intent = intents[0]
    if (!intent) throw new FinancialError('NOT_FOUND', 'Marketplace payment intent was not found', 404)
    if (actor.type === 'user' && actor.id !== intent.client_uid) {
      throw new FinancialError(
        'NOT_AUTHORIZED',
        'Only the paying client can confirm this payment',
        403
      )
    }

    const link = await loadMarketplacePaymentLink(conn, intent.id)
    assertMarketplaceProviderPayment(link, verified)

    if (intent.status === 'succeeded') {
      await conn.commit()
      return { bookingId: intent.booking_id, credited: false }
    }
    if (!['created', 'initialized', 'pending'].includes(intent.status)) {
      throw new FinancialError('INVALID_STATE', `Payment cannot succeed from ${intent.status}`, 409)
    }

    const [funds] = await conn.execute<JobFundRow[]>(
      'SELECT * FROM job_funds WHERE id = ? FOR UPDATE',
      [intent.job_fund_id]
    )
    const jobFund = funds[0]
    if (!jobFund) throw new FinancialError('NOT_FOUND', 'Job funds record was not found', 404)
    if (!['awaiting_funding', 'funding_pending', 'cancel_requested'].includes(jobFund.status)) {
      throw new FinancialError('INVALID_STATE', `Job funds cannot be locked from ${jobFund.status}`, 409)
    }
    const refundAfterCollection = jobFund.status === 'cancel_requested'

    const amount = minorFromDatabase(intent.amount_kobo)
    const posted = await ledger.postInTransaction(conn, {
      idempotencyKey: `paystack-payment:${verified.providerTransactionId}`,
      transactionType: 'job_funding_confirmed',
      amountMinor: amount,
      userUid: intent.client_uid,
      bookingId: intent.booking_id,
      externalReference: verified.reference,
      description: `Payment collected and locked for booking #${intent.booking_id}`,
      actor,
      entries: [
        { account: accounts.externalPaymentClearing(), deltaMinor: -amount },
        { account: accounts.clientLockedJobFunds(intent.booking_id), deltaMinor: amount },
      ],
      metadata: {
        paymentIntentId: intent.id,
        jobFundId: intent.job_fund_id,
        quoteId: intent.quote_id,
        artisanUid: jobFund.artisan_uid,
        requestId: intent.initiated_request_id,
        sessionFingerprint: intent.initiated_session_fingerprint,
        providerTransactionId: verified.providerTransactionId,
        paymentMethod: verified.paymentMethod,
        providerFeeMinor: String(verified.providerFeeMinor),
        chargedMinor: String(verified.requestedAmountMinor),
        description: `Payment secured for booking #${intent.booking_id}`,
      },
      outbox: {
        eventType: refundAfterCollection ? 'payment.refund_required' : 'job.funded',
        aggregateType: 'booking',
        aggregateId: String(intent.booking_id),
        payload: {
          bookingId: intent.booking_id,
          clientUid: intent.client_uid,
          artisanUid: jobFund.artisan_uid,
          amountMinor: amount.toString(),
        },
      },
    })

    assertTransition(paymentIntentTransitions, intent.status, 'succeeded', 'Payment intent')
    await conn.execute(
      `UPDATE marketplace_payment_intents
       SET provider_reference = ?, provider_transaction_id = ?, payment_method = ?,
           status = 'succeeded', confirmed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [verified.reference, verified.providerTransactionId, verified.paymentMethod, intent.id]
    )
    await conn.execute(
      `UPDATE job_funds
       SET status = 'locked', funded_transaction_id = ?,
           funded_amount_kobo = expected_amount_kobo,
           locked_amount_kobo = expected_amount_kobo,
           funded_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [posted.id, jobFund.id]
    )
    await conn.execute(
      `UPDATE booking_payment_accounts
       SET status = 'paid', paid_at = COALESCE(?, NOW()), updated_at = NOW()
       WHERE provider = ? AND provider_reference = ?`,
      [verified.paidAt ? new Date(verified.paidAt) : null, verified.provider, verified.reference]
    )
    await conn.execute(
      `UPDATE booking_payment_accounts
       SET status = 'cancelled', updated_at = NOW()
       WHERE booking_id = ? AND provider_reference <> ? AND status = 'active'`,
      [intent.booking_id, verified.reference]
    )
    if (refundAfterCollection) {
      await requestJobRefundInTransaction(conn, {
        bookingId: intent.booking_id,
        requestedByUid: intent.client_uid,
        reason: 'Payment completed after booking cancellation was requested',
        actor: { type: 'system', id: 'late-payment-refund' },
      })
      await conn.execute(
        `UPDATE bookings SET refundStatus = 'pending' WHERE bookingId = ?`,
        [intent.booking_id]
      )
    } else {
      const [acceptedQuoteRows] = await conn.execute<(RowDataPacket & { accepted: number })[]>(
        `SELECT COUNT(*) AS accepted
         FROM booking_quotes
         WHERE booking_id = ? AND status = 'accepted'`,
        [intent.booking_id]
      )
      await conn.execute(
        `UPDATE bookings SET bookingStatus = ? WHERE bookingId = ?`,
        [Number(acceptedQuoteRows[0]?.accepted ?? 0) > 0 ? 'Confirmed' : 'Pending', intent.booking_id]
      )
    }
    await conn.commit()
    return { bookingId: intent.booking_id, credited: !posted.idempotentReplay }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function markPayWithTransferRejected(
  reference: string,
  reason: string
): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [intentRows] = await conn.execute<PaymentIntentRow[]>(
      `SELECT * FROM marketplace_payment_intents
       WHERE internal_reference = ? OR (provider = 'paystack' AND provider_reference = ?)
       LIMIT 1 FOR UPDATE`,
      [reference, reference]
    )
    const intent = intentRows[0]
    if (!intent) {
      await conn.commit()
      return
    }
    if (['succeeded', 'refunded', 'partially_refunded', 'chargeback'].includes(intent.status)) {
      await conn.commit()
      return
    }
    await conn.execute(
      `UPDATE marketplace_payment_intents
       SET status = 'failed', failure_reason = ?, failed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [reason.slice(0, 500), intent.id]
    )
    await conn.execute(
      `UPDATE booking_payment_accounts
       SET status = 'rejected', updated_at = NOW()
       WHERE marketplace_payment_intent_id = ?`,
      [intent.id]
    )
    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function releaseJobFundsToArtisanInTransaction(
  conn: PoolConnection,
  input: { bookingId: number; actor: LedgerActor }
): Promise<{ idempotentReplay: boolean; earningsAvailableAfter: Date | null }> {
  const [rows] = await conn.execute<JobFundRow[]>(
    'SELECT * FROM job_funds WHERE booking_id = ? FOR UPDATE',
    [input.bookingId]
  )
  const jobFund = rows[0]
  if (!jobFund) throw new FinancialError('NOT_FOUND', 'Job funds were not found', 404)
  if (jobFund.status === 'released') {
    return { idempotentReplay: true, earningsAvailableAfter: null }
  }
  if (jobFund.status !== 'locked') {
    throw new FinancialError('INVALID_STATE', `Job funds cannot be released from ${jobFund.status}`, 409)
  }

  const amount = minorFromDatabase(jobFund.expected_amount_kobo)
  await assertVerifiedJobFundingInTransaction(conn, jobFund, amount)
  const fee = minorFromDatabase(jobFund.platform_fee_kobo)
  const earnings = amount - fee
  if (earnings <= BigInt(0)) throw new FinancialError('INVALID_AMOUNT', 'Fee consumes job funds')

  const pending = await ledger.ensureAccountInTransaction(
    conn,
    accounts.artisanPendingEarnings(jobFund.artisan_uid)
  )
  const available = await ledger.ensureAccountInTransaction(
    conn,
    accounts.artisanAvailableEarnings(jobFund.artisan_uid)
  )
  const posted = await ledger.postInTransaction(conn, {
    idempotencyKey: `job-release:${jobFund.id}`,
    transactionType: 'job_funds_released',
    amountMinor: amount,
    userUid: jobFund.artisan_uid,
    bookingId: input.bookingId,
    description: `Booking #${input.bookingId} earnings entered the safety hold`,
    actor: input.actor,
    entries: [
      { account: accounts.clientLockedJobFunds(input.bookingId), deltaMinor: -amount },
      { account: accounts.artisanPendingEarnings(jobFund.artisan_uid), deltaMinor: earnings },
      { account: accounts.platformCommissionRevenue(), deltaMinor: fee },
    ],
    metadata: {
      jobFundId: jobFund.id,
      feeMinor: fee.toString(),
      earningsMinor: earnings.toString(),
    },
    outbox: {
      eventType: 'earnings.held',
      aggregateType: 'job_fund',
      aggregateId: String(jobFund.id),
      payload: {
        bookingId: input.bookingId,
        artisanUid: jobFund.artisan_uid,
        amountMinor: earnings.toString(),
      },
    },
  })

  const holdHours = getFinancialConfig().DEFAULT_WITHDRAWAL_HOLD_HOURS
  await conn.execute(
    `INSERT INTO earnings_holds (
       job_fund_id, artisan_uid, pending_account_id, available_account_id,
       amount_kobo, status, reason, release_after
     ) VALUES (?, ?, ?, ?, ?, 'held', 'Marketplace completion safety hold',
       DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [jobFund.id, jobFund.artisan_uid, pending.id, available.id, earnings.toString(), holdHours]
  )
  await conn.execute(
    `UPDATE job_funds
     SET status = 'released', release_transaction_id = ?,
         locked_amount_kobo = 0, released_amount_kobo = expected_amount_kobo,
         released_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [posted.id, jobFund.id]
  )

  const [releaseRows] = await conn.execute<(RowDataPacket & { release_after: Date })[]>(
    'SELECT release_after FROM earnings_holds WHERE job_fund_id = ?',
    [jobFund.id]
  )
  return {
    idempotentReplay: posted.idempotentReplay,
    earningsAvailableAfter: releaseRows[0]?.release_after ?? null,
  }
}

async function assertVerifiedJobFundingInTransaction(
  conn: PoolConnection,
  jobFund: JobFundRow,
  expectedAmount: MinorAmount
): Promise<void> {
  if (!jobFund.funded_transaction_id) {
    throw new FinancialError(
      'INVALID_STATE',
      'Job funding transaction is missing; artisan earnings cannot be credited',
      409
    )
  }
  const [rows] = await conn.execute<(RowDataPacket & {
    id: number
    transaction_type: string
    amount_kobo: string | number
    booking_id: number | null
    status: string
  })[]>(
    `SELECT id, transaction_type, amount_kobo, booking_id, status
     FROM money_transactions WHERE id = ? FOR SHARE`,
    [jobFund.funded_transaction_id]
  )
  const funding = rows[0]
  if (
    !funding ||
    funding.status !== 'success' ||
    funding.booking_id !== jobFund.booking_id ||
    minorFromDatabase(funding.amount_kobo) !== expectedAmount ||
    !['job_wallet_funds_locked', 'job_funding_confirmed'].includes(funding.transaction_type)
  ) {
    throw new FinancialError(
      'INVALID_STATE',
      'Job funding transaction could not be verified; artisan earnings were not credited',
      409
    )
  }

  const [entryRows] = await conn.execute<(RowDataPacket & {
    locked_total: string | number
  })[]>(
    `SELECT COALESCE(SUM(CASE WHEN account_id = ? THEN delta_kobo ELSE 0 END), 0) AS locked_total
     FROM money_entries WHERE transaction_id = ?`,
    [jobFund.locked_account_id, jobFund.funded_transaction_id]
  )
  if (minorFromDatabase(entryRows[0]?.locked_total ?? 0) !== expectedAmount) {
    throw new FinancialError(
      'INVALID_STATE',
      'Locked job funds do not match the verified funding transaction',
      409
    )
  }

  if (funding.transaction_type === 'job_funding_confirmed') {
    const [intentRows] = await conn.execute<(RowDataPacket & {
      provider_transaction_id: string | null
      status: string
    })[]>(
      `SELECT provider_transaction_id, status
       FROM marketplace_payment_intents
       WHERE job_fund_id = ? ORDER BY id DESC LIMIT 1 FOR SHARE`,
      [jobFund.id]
    )
    if (
      intentRows[0]?.status !== 'succeeded' ||
      !intentRows[0]?.provider_transaction_id
    ) {
      throw new FinancialError(
        'INVALID_STATE',
        'External job payment transaction ID was not verified',
        409
      )
    }
  } else {
    const [provenanceRows] = await conn.execute<(RowDataPacket & {
      verified_funding: string | number
      released_jobs: string | number
    })[]>(
      `SELECT
         (SELECT COALESCE(SUM(wfi.credited_amount_kobo), 0)
          FROM wallet_funding_intents wfi
          JOIN money_transactions funding_tx
            ON funding_tx.id = wfi.ledger_transaction_id
           AND funding_tx.transaction_type = 'wallet_funding_confirmed'
           AND funding_tx.status = 'success'
          WHERE wfi.client_uid = ?
            AND wfi.status = 'succeeded'
            AND wfi.provider_transaction_id IS NOT NULL
            AND wfi.receipt_number IS NOT NULL
            AND wfi.credited_amount_kobo = wfi.requested_amount_kobo
         ) AS verified_funding,
         (SELECT COALESCE(SUM(released.expected_amount_kobo), 0)
          FROM job_funds released
          JOIN money_transactions released_funding
            ON released_funding.id = released.funded_transaction_id
           AND released_funding.transaction_type = 'job_wallet_funds_locked'
           AND released_funding.status = 'success'
          WHERE released.client_uid = ?
            AND released.status = 'released'
         ) AS released_jobs`,
      [jobFund.client_uid, jobFund.client_uid]
    )
    const verifiedFunding = minorFromDatabase(
      provenanceRows[0]?.verified_funding ?? 0
    )
    const alreadyReleased = minorFromDatabase(
      provenanceRows[0]?.released_jobs ?? 0
    )
    if (verifiedFunding < alreadyReleased + expectedAmount) {
      throw new FinancialError(
        'INVALID_STATE',
        'Verified Paystack wallet funding does not cover this job release',
        409
      )
    }
  }
}

export async function requestJobRefundInTransaction(
  conn: PoolConnection,
  input: { bookingId: number; requestedByUid: string; reason: string; actor: LedgerActor }
): Promise<{ refundReference: string; idempotentReplay: boolean }> {
  const [rows] = await conn.execute<JobFundRow[]>(
    'SELECT * FROM job_funds WHERE booking_id = ? FOR UPDATE',
    [input.bookingId]
  )
  const jobFund = rows[0]
  if (!jobFund) throw new FinancialError('NOT_FOUND', 'Job funds were not found', 404)
  if (
    ![jobFund.client_uid, jobFund.artisan_uid].includes(input.requestedByUid) &&
    input.actor.type !== 'admin'
  ) {
    throw new FinancialError(
      'NOT_AUTHORIZED',
      'Only a booking party or finance admin can request this refund',
      403
    )
  }
  if (jobFund.status === 'refund_pending' || jobFund.status === 'refunded') {
    const existing = await queryRefundByJob(conn, jobFund.id)
    return { refundReference: existing?.internal_reference ?? '', idempotentReplay: true }
  }
  if (jobFund.status !== 'locked') {
    throw new FinancialError('INVALID_STATE', `Job funds cannot be refunded from ${jobFund.status}`, 409)
  }

  const amount = minorFromDatabase(jobFund.expected_amount_kobo)
  const refundReference = financialReference('job-refund')
  const posted = await ledger.postInTransaction(conn, {
    idempotencyKey: `job-refund-reserve:${jobFund.id}`,
    transactionType: 'job_refund_reserved',
    amountMinor: amount,
    userUid: jobFund.client_uid,
    bookingId: input.bookingId,
    description: `Booking #${input.bookingId} refund reserved for provider processing`,
    actor: input.actor,
    entries: [
      { account: accounts.clientLockedJobFunds(input.bookingId), deltaMinor: -amount },
      { account: accounts.clientRefundPending(jobFund.client_uid), deltaMinor: amount },
    ],
    metadata: { jobFundId: jobFund.id, reason: input.reason },
    outbox: {
      eventType: 'refund.requested',
      aggregateType: 'job_fund',
      aggregateId: String(jobFund.id),
      payload: { jobFundId: jobFund.id, refundReference },
    },
  })
  await conn.execute(
    `INSERT INTO refund_requests (
       internal_reference, job_fund_id, requested_by_uid, amount_kobo,
       currency, status, reason, ledger_transaction_id
     ) VALUES (?, ?, ?, ?, 'NGN', 'requested', ?, ?)`,
    [
      refundReference,
      jobFund.id,
      input.requestedByUid,
      amount.toString(),
      input.reason.slice(0, 500),
      posted.id,
    ]
  )
  await conn.execute(
    `UPDATE job_funds
     SET status = 'refund_pending', refund_transaction_id = ?,
         locked_amount_kobo = 0, updated_at = NOW()
     WHERE id = ?`,
    [posted.id, jobFund.id]
  )
  return { refundReference, idempotentReplay: posted.idempotentReplay }
}

export async function cancelOrRefundJobInTransaction(
  conn: PoolConnection,
  input: { bookingId: number; requestedByUid: string; reason: string; actor: LedgerActor }
): Promise<{ refundReference: string | null; idempotentReplay: boolean }> {
  const [rows] = await conn.execute<JobFundRow[]>(
    'SELECT * FROM job_funds WHERE booking_id = ? FOR UPDATE',
    [input.bookingId]
  )
  const jobFund = rows[0]
  if (!jobFund) throw new FinancialError('NOT_FOUND', 'Job funds were not found', 404)
  if (jobFund.status === 'awaiting_funding') {
    await conn.execute(
      `UPDATE marketplace_payment_intents
       SET status = 'cancelled', updated_at = NOW()
       WHERE job_fund_id = ? AND status IN ('created','initialized','pending')`,
      [jobFund.id]
    )
    await conn.execute(
      `UPDATE job_funds
       SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [jobFund.id]
    )
    await writeAudit(conn, {
      actor: input.actor,
      action: 'job_funding.cancelled_unfunded',
      resourceType: 'job_fund',
      resourceId: String(jobFund.id),
      details: { bookingId: input.bookingId, reason: input.reason },
    })
    return { refundReference: null, idempotentReplay: false }
  }
  if (jobFund.status === 'funding_pending') {
    await conn.execute(
      `UPDATE job_funds SET status = 'cancel_requested', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [jobFund.id]
    )
    await writeAudit(conn, {
      actor: input.actor,
      action: 'job_funding.cancellation_requested',
      resourceType: 'job_fund',
      resourceId: String(jobFund.id),
      details: { bookingId: input.bookingId, reason: input.reason },
    })
    return { refundReference: null, idempotentReplay: false }
  }
  if (jobFund.status === 'cancel_requested' || jobFund.status === 'cancelled') {
    return { refundReference: null, idempotentReplay: true }
  }
  if (jobFund.status === 'locked' && jobFund.funded_transaction_id) {
    const [fundingRows] = await conn.execute<(RowDataPacket & {
      transaction_type: string
    })[]>(
      `SELECT transaction_type FROM money_transactions
       WHERE id = ? AND status = 'success' FOR SHARE`,
      [jobFund.funded_transaction_id]
    )
    if (fundingRows[0]?.transaction_type === 'job_wallet_funds_locked') {
      const amount = minorFromDatabase(jobFund.expected_amount_kobo)
      const posted = await ledger.postInTransaction(conn, {
        idempotencyKey: `job-wallet-return:${jobFund.id}`,
        transactionType: 'job_wallet_funds_returned',
        amountMinor: amount,
        userUid: jobFund.client_uid,
        bookingId: input.bookingId,
        description: `Booking #${input.bookingId} funds returned to client wallet`,
        actor: input.actor,
        entries: [
          { account: accounts.clientLockedJobFunds(input.bookingId), deltaMinor: -amount },
          { account: accounts.clientAvailable(jobFund.client_uid), deltaMinor: amount },
        ],
        metadata: {
          jobFundId: jobFund.id,
          originalFundingTransactionId: jobFund.funded_transaction_id,
          reason: input.reason,
        },
        outbox: {
          eventType: 'job.wallet_funds_returned',
          aggregateType: 'booking',
          aggregateId: String(input.bookingId),
          payload: {
            bookingId: input.bookingId,
            clientUid: jobFund.client_uid,
            amountMinor: amount.toString(),
          },
        },
      })
      await conn.execute(
        `UPDATE job_funds
         SET status = 'cancelled', refund_transaction_id = ?,
             locked_amount_kobo = 0, cancelled_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [posted.id, jobFund.id]
      )
      await writeAudit(conn, {
        actor: input.actor,
        action: 'job_funding.returned_to_client_wallet',
        resourceType: 'job_fund',
        resourceId: String(jobFund.id),
        reference: posted.reference,
        details: {
          bookingId: input.bookingId,
          amountMinor: amount.toString(),
          originalFundingTransactionId: jobFund.funded_transaction_id,
          reason: input.reason,
        },
      })
      return { refundReference: null, idempotentReplay: posted.idempotentReplay }
    }
  }
  const result = await requestJobRefundInTransaction(conn, input)
  return { refundReference: result.refundReference, idempotentReplay: result.idempotentReplay }
}

export async function releaseMaturedEarnings(limit = 50): Promise<number> {
  const rows = await queryOne<(RowDataPacket & { count: number })[]>(
    `SELECT COUNT(*) AS count FROM earnings_holds
     WHERE status = 'held' AND release_after <= NOW()`
  )
  if (!rows || Number(rows.count) === 0) return 0

  let released = 0
  for (let iteration = 0; iteration < Math.min(limit, Number(rows.count)); iteration += 1) {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()
      const [holds] = await conn.execute<(RowDataPacket & {
        id: number
        job_fund_id: number
        artisan_uid: string
        amount_kobo: string | number
      })[]>(
        `SELECT id, job_fund_id, artisan_uid, amount_kobo
         FROM earnings_holds
         WHERE status = 'held' AND release_after <= NOW()
         ORDER BY release_after, id LIMIT 1 FOR UPDATE SKIP LOCKED`
      )
      const hold = holds[0]
      if (!hold) {
        await conn.commit()
        break
      }
      const amount = minorFromDatabase(hold.amount_kobo)
      const posted = await ledger.postInTransaction(conn, {
        idempotencyKey: `earnings-hold-release:${hold.id}`,
        transactionType: 'earnings_hold_released',
        amountMinor: amount,
        userUid: hold.artisan_uid,
        description: 'Marketplace earnings became withdrawable',
        actor: { type: 'worker', id: 'earnings-release-worker' },
        entries: [
          { account: accounts.artisanPendingEarnings(hold.artisan_uid), deltaMinor: -amount },
          { account: accounts.artisanAvailableEarnings(hold.artisan_uid), deltaMinor: amount },
        ],
        metadata: { earningsHoldId: hold.id, jobFundId: hold.job_fund_id },
        outbox: {
          eventType: 'earnings.available',
          aggregateType: 'earnings_hold',
          aggregateId: String(hold.id),
          payload: { artisanUid: hold.artisan_uid, amountMinor: amount.toString() },
        },
      })
      await conn.execute(
        `UPDATE earnings_holds
         SET status = 'released', release_transaction_id = ?, released_at = NOW()
         WHERE id = ?`,
        [posted.id, hold.id]
      )
      await conn.commit()
      released += 1
    } catch (error) {
      await conn.rollback().catch(() => undefined)
      throw error
    } finally {
      conn.release()
    }
  }
  return released
}

export async function getMarketplaceWalletSnapshot(
  uid: string,
  role: 'client' | 'artisan'
) {
  const availablePurpose =
    role === 'artisan' ? 'artisan_available_earnings' : 'client_available'
  const [balanceRow, stateRow, recipient, transactions] = await Promise.all([
    queryOne<(RowDataPacket & { balance: string | number })[]>(
      `SELECT COALESCE(SUM(balance_kobo), 0) AS balance
       FROM money_accounts
       WHERE owner_id = ? AND owner_type = ? AND purpose = ? AND currency = 'NGN'`,
      [uid, role, availablePurpose]
    ),
    role === 'artisan'
      ? queryOne<(RowDataPacket & {
          pending: string | number
          totalEarned: string | number
          withdrawalPending: string | number
          totalWithdrawn: string | number
          platformFees: string | number
        })[]>(
          `SELECT
             COALESCE(SUM(CASE WHEN purpose = 'artisan_pending_earnings'
                               THEN balance_kobo ELSE 0 END), 0) AS pending,
             COALESCE(SUM(CASE WHEN purpose IN (
               'artisan_pending_earnings','artisan_available_earnings',
               'artisan_withdrawal_pending','artisan_withdrawn_earnings'
             ) THEN balance_kobo ELSE 0 END), 0) AS totalEarned,
             COALESCE(SUM(CASE WHEN purpose = 'artisan_withdrawal_pending'
                               THEN balance_kobo ELSE 0 END), 0) AS withdrawalPending,
             COALESCE(SUM(CASE WHEN purpose = 'artisan_withdrawn_earnings'
                               THEN balance_kobo ELSE 0 END), 0) AS totalWithdrawn,
             (SELECT COALESCE(SUM(platform_fee_kobo), 0)
              FROM job_funds WHERE artisan_uid = ? AND status IN ('released','disputed'))
               AS platformFees
           FROM money_accounts
           WHERE owner_type = 'artisan' AND owner_id = ? AND currency = 'NGN'`,
          [uid, uid]
        )
      : queryOne<(RowDataPacket & {
          pending: string | number
          totalEarned: string | number
          withdrawalPending: string | number
          totalWithdrawn: string | number
          platformFees: string | number
          totalFunded: string | number
          totalSpent: string | number
          totalPaid: string | number
          refundable: string | number
        })[]>(
          `SELECT
             COALESCE(SUM(CASE WHEN status = 'refund_pending'
                               THEN expected_amount_kobo ELSE 0 END), 0) AS refundPending,
             COALESCE(SUM(locked_amount_kobo), 0) AS pending,
             0 AS totalEarned, 0 AS withdrawalPending, 0 AS totalWithdrawn,
             0 AS platformFees,
             (SELECT COALESCE(SUM(credited_amount_kobo), 0)
              FROM wallet_funding_intents
              WHERE client_uid = ? AND status = 'succeeded') AS totalFunded,
             COALESCE(SUM(released_amount_kobo), 0) AS totalSpent,
             COALESCE(SUM(funded_amount_kobo), 0) AS totalPaid,
             (SELECT COALESCE(SUM(balance_kobo), 0)
              FROM money_accounts
              WHERE owner_type = 'client' AND owner_id = ?
                AND purpose = 'client_refundable' AND currency = 'NGN') AS refundable
           FROM job_funds
           WHERE client_uid = ?`,
          [uid, uid, uid]
        ),
    role === 'artisan'
      ? queryOne<(RowDataPacket & {
          bank_name: string
          bank_code: string
          account_number_last_four: string
          provider_recipient_code: string
        })[]>(
          `SELECT bank_name, bank_code, account_number_last_four, provider_recipient_code
           FROM transfer_recipients
           WHERE user_uid = ? AND status = 'active' AND is_default = 1
           ORDER BY id DESC LIMIT 1`,
          [uid]
        )
      : Promise.resolve(null),
    query<(RowDataPacket & {
      id: number
      reference: string
      transaction_type: string
      amount_kobo: string | number
      status: string
      booking_id: number | null
      metadata: string | Record<string, unknown> | null
      created_at: Date
    })[]>(
      `SELECT id, reference, transaction_type, amount_kobo, status, booking_id, metadata, created_at
       FROM money_transactions
       WHERE user_uid = ?
       ORDER BY id DESC LIMIT 100`,
      [uid]
    ),
  ])

  const availableBalance = Number(balanceRow?.balance ?? 0) / 100
  const pendingBalance = Number(stateRow?.pending ?? 0) / 100
  const totalEarned = Number(stateRow?.totalEarned ?? 0) / 100
  return {
    wallet: {
      id: `marketplace-${uid}`,
      userId: uid,
      availableBalance,
      escrowBalance: pendingBalance,
      totalEarned,
      pendingBalance,
      refundPendingBalance: Number(
        (stateRow as (typeof stateRow & { refundPending?: string | number }))?.refundPending ?? 0
      ) / 100,
      refundableBalance: Number(
        (stateRow as (typeof stateRow & { refundable?: string | number }))?.refundable ?? 0
      ) / 100,
      withdrawalPendingBalance: Number(stateRow?.withdrawalPending ?? 0) / 100,
      totalWithdrawn: Number(stateRow?.totalWithdrawn ?? 0) / 100,
      platformFees: Number(stateRow?.platformFees ?? 0) / 100,
      totalFunded: Number(
        (stateRow as (typeof stateRow & { totalFunded?: string | number }))?.totalFunded ?? 0
      ) / 100,
      totalSpent: Number(
        (stateRow as (typeof stateRow & { totalSpent?: string | number }))?.totalSpent ?? 0
      ) / 100,
      totalPaid: Number(
        (stateRow as (typeof stateRow & { totalPaid?: string | number }))?.totalPaid ?? 0
      ) / 100,
      isVerified: Boolean(recipient),
      paystackRecipientCode: recipient?.provider_recipient_code ?? null,
      bankName: recipient?.bank_name ?? null,
      bankCode: recipient?.bank_code ?? null,
      bankAccountNumber: recipient ? `****${recipient.account_number_last_four}` : null,
      createdAt: null,
      updatedAt: null,
    },
    transactions: transactions.map((transaction) => {
      const metadata =
        typeof transaction.metadata === 'string'
          ? safeJson(transaction.metadata)
          : transaction.metadata ?? {}
      const displayedAmountMinor =
        transaction.transaction_type === 'job_funds_released' &&
        typeof metadata.earningsMinor === 'string'
          ? Number(metadata.earningsMinor)
          : Number(transaction.amount_kobo)
      return {
        id: `ledger-${transaction.id}`,
        type: walletTransactionType(transaction.transaction_type),
        amountNGN: displayedAmountMinor / 100,
        description:
          typeof metadata.description === 'string'
            ? metadata.description
            : readableTransactionType(transaction.transaction_type),
        status: transaction.status === 'success' ? 'success' : transaction.status,
        createdAt: transaction.created_at,
        reference: transaction.reference,
        bookingId: transaction.booking_id,
        platformFeeNGN:
          typeof metadata.feeMinor === 'string' ? Number(metadata.feeMinor) / 100 : null,
        receiptNumber:
          typeof metadata.receiptNumber === 'string' ? metadata.receiptNumber : null,
        providerTransactionId:
          typeof metadata.providerTransactionId === 'string'
            ? metadata.providerTransactionId
            : null,
        providerFeeNGN:
          typeof metadata.providerFeeMinor === 'string'
            ? Number(metadata.providerFeeMinor) / 100
            : null,
        chargedAmountNGN:
          typeof metadata.chargedMinor === 'string'
            ? Number(metadata.chargedMinor) / 100
            : null,
        paymentMethod:
          typeof metadata.paymentMethod === 'string' ? metadata.paymentMethod : null,
      }
    }),
  }
}

async function activeFeeRule(conn: PoolConnection): Promise<FeeRuleRow> {
  const ruleCode = process.env.PLATFORM_FEE_RULE || 'marketplace-standard'
  const [rows] = await conn.execute<FeeRuleRow[]>(
    `SELECT id, fee_basis_points, minimum_fee_kobo, maximum_fee_kobo
     FROM platform_fee_rules
     WHERE rule_code = ? AND status = 'active' AND effective_from <= NOW()
       AND (effective_until IS NULL OR effective_until > NOW())
     ORDER BY version DESC LIMIT 1 FOR SHARE`,
    [ruleCode]
  )
  if (!rows[0]) throw new FinancialError('CONFIGURATION_ERROR', 'No active platform fee rule')
  return rows[0]
}

async function updateInitializedPaymentIntent(
  input: JobPayWithTransferInput,
  providerReference: string
): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<PaymentIntentRow[]>(
      'SELECT * FROM marketplace_payment_intents WHERE id = ? FOR UPDATE',
      [input.intentId]
    )
    const intent = rows[0]
    if (!intent) throw new FinancialError('NOT_FOUND', 'Payment intent was not found', 404)
    const link = await loadMarketplacePaymentLink(conn, input.intentId)
    assertMarketplacePaymentLink(link, { requirePaymentAccount: false })
    assertInitializationMatches(link, input)
    if (intent.status === 'initialized' && intent.provider_reference === providerReference) {
      await conn.commit()
      return
    }
    assertTransition(paymentIntentTransitions, intent.status, 'initialized', 'Payment intent')
    await conn.execute(
      `UPDATE marketplace_payment_intents
       SET provider_reference = ?, status = 'initialized', initialized_at = NOW(), updated_at = NOW()
      WHERE id = ?`,
      [providerReference, input.intentId]
    )
    await conn.execute(
      `UPDATE job_funds SET status = 'funding_pending', updated_at = NOW()
       WHERE id = ? AND status = 'awaiting_funding'`,
      [intent.job_fund_id]
    )
    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

async function markPaymentInitializationFailed(intentId: number, reason: string): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.execute(
      `UPDATE marketplace_payment_intents
       SET status = 'failed', failure_reason = ?, failed_at = NOW(), updated_at = NOW()
       WHERE id = ? AND status = 'created'`,
      [reason.slice(0, 500), intentId]
    )
  } finally {
    conn.release()
  }
}

function validateProviderPayment(verified: PaymentVerificationResult): void {
  const config = getFinancialConfig()
  if (verified.status !== 'succeeded') {
    throw new FinancialError('INVALID_STATE', `Provider payment is ${verified.status}`, 409)
  }
  if (verified.currency !== 'NGN') {
    throw new FinancialError('CURRENCY_MISMATCH', 'Provider returned an unexpected currency')
  }
  if (verified.environment !== config.PAYSTACK_ENVIRONMENT) {
    throw new FinancialError('PROVIDER_UNAVAILABLE', 'Provider environment mismatch', 502)
  }
  if (
    !Number.isSafeInteger(verified.amountMinor) ||
    !Number.isSafeInteger(verified.requestedAmountMinor) ||
    verified.amountMinor <= 0 ||
    verified.requestedAmountMinor <= 0
  ) {
    throw new FinancialError('INVALID_AMOUNT', 'Provider returned an invalid amount')
  }
  if (
    !Number.isSafeInteger(verified.providerFeeMinor) ||
    verified.providerFeeMinor < 0 ||
    verified.providerFeeMinor > verified.amountMinor
  ) {
    throw new FinancialError('INVALID_AMOUNT', 'Provider returned an invalid fee')
  }
}

async function validateMarketplacePaymentInitialization(
  input: JobPayWithTransferInput
): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const link = await loadMarketplacePaymentLink(conn, input.intentId)
    assertMarketplacePaymentLink(link, { requirePaymentAccount: false })
    assertInitializationMatches(link, input)
    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

function assertInitializationMatches(
  link: MarketplacePaymentLink,
  input: JobPayWithTransferInput
): void {
  if (
    link.intent.id !== input.intentId ||
    link.intent.internalReference !== input.reference ||
    link.intent.bookingId !== input.bookingId ||
    link.intent.jobFundId !== input.jobFundId ||
    link.intent.quoteId !== input.quoteId ||
    link.intent.clientUid !== input.clientUid ||
    link.intent.customerEmail.toLowerCase() !== input.customerEmail.toLowerCase() ||
    link.intent.amountMinor !== BigInt(input.amountMinor) ||
    link.intent.requestId !== input.requestId ||
    link.intent.sessionFingerprint !== input.sessionFingerprint
  ) {
    throw new FinancialError(
      'NOT_AUTHORIZED',
      'Payment initialization does not match the authenticated booking request.',
      403
    )
  }
}

async function loadMarketplacePaymentLink(
  conn: PoolConnection,
  intentId: number
): Promise<MarketplacePaymentLink> {
  const [rows] = await conn.execute<MarketplacePaymentLinkRow[]>(
    `SELECT
       mpi.id AS intent_id,
       mpi.internal_reference AS intent_internal_reference,
       mpi.booking_id AS intent_booking_id,
       mpi.job_fund_id AS intent_job_fund_id,
       mpi.quote_id AS intent_quote_id,
       mpi.client_uid AS intent_client_uid,
       mpi.customer_email AS intent_customer_email,
       mpi.amount_kobo AS intent_amount_kobo,
       mpi.currency AS intent_currency,
       mpi.provider AS intent_provider,
       mpi.provider_reference AS intent_provider_reference,
       mpi.initiated_request_id AS intent_request_id,
       mpi.initiated_session_fingerprint AS intent_session_fingerprint,
       jf.id AS job_fund_id,
       jf.booking_id AS job_fund_booking_id,
       jf.quote_id AS job_fund_quote_id,
       jf.client_uid AS job_fund_client_uid,
       jf.artisan_uid AS job_fund_artisan_uid,
       jf.expected_amount_kobo AS job_fund_amount_kobo,
       jf.currency AS job_fund_currency,
       q.id AS quote_id,
       q.booking_id AS quote_booking_id,
       q.artisan_uid AS quote_artisan_uid,
       q.amount AS quote_amount,
       q.status AS quote_status,
       b.bookingId AS booking_id,
       b.clientUID AS booking_client_uid,
       bus.uid AS booking_artisan_uid,
       b.amountAgreed AS booking_amount,
       b.bookingStatus AS booking_status,
       bpa.marketplace_payment_intent_id AS account_payment_intent_id,
       bpa.booking_id AS account_booking_id,
       bpa.quote_id AS account_quote_id,
       bpa.client_uid AS account_client_uid,
       bpa.amount_kobo AS account_amount_kobo,
       bpa.currency AS account_currency,
       bpa.provider AS account_provider,
       bpa.provider_reference AS account_provider_reference,
       bpa.status AS account_status
     FROM marketplace_payment_intents mpi
     JOIN job_funds jf ON jf.id = mpi.job_fund_id
     JOIN booking_quotes q ON q.id = mpi.quote_id
     JOIN bookings b ON b.bookingId = mpi.booking_id
     JOIN businesses bus ON bus.businessId = b.businessId
     LEFT JOIN booking_payment_accounts bpa
       ON bpa.marketplace_payment_intent_id = mpi.id
     WHERE mpi.id = ?
     ORDER BY bpa.id DESC
     LIMIT 1
     FOR UPDATE`,
    [intentId]
  )
  const row = rows[0]
  if (!row) {
    throw new FinancialError(
      'INVALID_STATE',
      'The payment is missing a required booking or quote relationship.',
      409
    )
  }

  const account = row.account_payment_intent_id === null
    ? undefined
    : {
        paymentIntentId: Number(row.account_payment_intent_id),
        bookingId: Number(row.account_booking_id),
        quoteId: Number(row.account_quote_id),
        clientUid: String(row.account_client_uid),
        amountMinor: minorFromDatabase(row.account_amount_kobo ?? 0),
        currency: String(row.account_currency),
        provider: String(row.account_provider),
        providerReference: String(row.account_provider_reference),
        status: String(row.account_status),
      }

  return {
    intent: {
      id: Number(row.intent_id),
      internalReference: row.intent_internal_reference,
      bookingId: Number(row.intent_booking_id),
      jobFundId: Number(row.intent_job_fund_id),
      quoteId: Number(row.intent_quote_id),
      clientUid: row.intent_client_uid,
      customerEmail: row.intent_customer_email,
      amountMinor: minorFromDatabase(row.intent_amount_kobo),
      currency: row.intent_currency,
      provider: row.intent_provider,
      providerReference: row.intent_provider_reference,
      requestId: row.intent_request_id,
      sessionFingerprint: row.intent_session_fingerprint,
    },
    jobFund: {
      id: Number(row.job_fund_id),
      bookingId: Number(row.job_fund_booking_id),
      quoteId: Number(row.job_fund_quote_id),
      clientUid: row.job_fund_client_uid,
      artisanUid: row.job_fund_artisan_uid,
      amountMinor: minorFromDatabase(row.job_fund_amount_kobo),
      currency: row.job_fund_currency,
    },
    quote: {
      id: Number(row.quote_id),
      bookingId: Number(row.quote_booking_id),
      artisanUid: row.quote_artisan_uid,
      amountMinor: majorToMinor(String(row.quote_amount)),
      status: row.quote_status,
    },
    booking: {
      id: Number(row.booking_id),
      clientUid: row.booking_client_uid,
      artisanUid: row.booking_artisan_uid,
      amountMinor: majorToMinor(String(row.booking_amount)),
      status: row.booking_status,
    },
    account,
  }
}

async function queryRefundByJob(conn: PoolConnection, jobFundId: number) {
  const [rows] = await conn.execute<(RowDataPacket & { internal_reference: string })[]>(
    `SELECT internal_reference FROM refund_requests
     WHERE job_fund_id = ? ORDER BY id DESC LIMIT 1`,
    [jobFundId]
  )
  return rows[0]
}

async function writeAudit(
  conn: PoolConnection,
  input: {
    actor: LedgerActor
    action: string
    resourceType: string
    resourceId: string
    reference?: string
    details?: Record<string, unknown>
  }
): Promise<void> {
  await conn.execute(
    `INSERT INTO financial_audit_logs (
       actor_type, actor_id, action, resource_type, resource_id,
       internal_reference, details, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      input.actor.type,
      input.actor.id,
      input.action,
      input.resourceType,
      input.resourceId,
      input.reference ?? null,
      JSON.stringify(input.details ?? {}),
    ]
  )
}

function financialReference(prefix: string): string {
  return `${prefix}-${randomUUID()}`.slice(0, 50)
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Provider request failed'
}

function safeJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return {}
  }
}

function walletTransactionType(type: string): string {
  if (type === 'wallet_funding_confirmed') return 'credit'
  if (type === 'job_wallet_funds_locked') return 'escrow_lock'
  if (type === 'job_funding_confirmed') return 'job_payment'
  if (type === 'job_funds_released') return 'earning'
  if (type.includes('earnings')) return 'earning'
  if (type.includes('refund')) return 'refund'
  if (type.includes('withdrawal')) return 'debit'
  return 'credit'
}

function readableTransactionType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export type { PaystackGateway }
