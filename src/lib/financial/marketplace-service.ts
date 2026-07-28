import { randomUUID } from 'crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getConnection, query, queryOne } from '@/lib/db'
import { accounts } from './account-types'
import { getFinancialConfig } from './config'
import { FinancialError } from './errors'
import { LedgerService, type LedgerActor } from './ledger-service'
import {
  calculateBasisPoints,
  minorFromDatabase,
  toSafeDatabaseInteger,
  type MinorAmount,
} from './money-value'
import { paymentRail, type PaystackGateway } from './paystack-gateway'
import type { PaymentRail, PaymentVerificationResult } from './payment-rail'
import { assertTransition, jobFundsTransitions, paymentIntentTransitions } from './state-machines'

type FeeRuleRow = RowDataPacket & {
  id: number
  fee_basis_points: number
  minimum_fee_kobo: string | number
  maximum_fee_kobo: string | number | null
}

type JobFundRow = RowDataPacket & {
  id: number
  booking_id: number
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
  provider_reference: string | null
  booking_id: number
  job_fund_id: number
  client_uid: string
  customer_email: string
  amount_kobo: string | number
  currency: string
  status: keyof typeof paymentIntentTransitions
}

export type JobFundingInitialization = {
  intentId: number
  jobFundId: number
  reference: string
  amountMinor: number
}

const ledger = new LedgerService()

export function isMarketplaceFinanceEnabled(): boolean {
  const enabled = process.env.MARKETPLACE_FINANCE_V3_ENABLED === 'true'
  if (enabled) getFinancialConfig()
  return enabled
}

export async function createJobFundingInTransaction(
  conn: PoolConnection,
  input: {
    bookingId: number
    clientUid: string
    artisanUid: string
    customerEmail: string
    amountMinor: MinorAmount
    actor: LedgerActor
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
       booking_id, client_uid, artisan_uid, currency, expected_amount_kobo,
       locked_account_id, status, fee_rule_id, platform_fee_kobo
     ) VALUES (?, ?, ?, 'NGN', ?, ?, 'awaiting_funding', ?, ?)`,
    [
      input.bookingId,
      input.clientUid,
      input.artisanUid,
      input.amountMinor.toString(),
      lockedAccount.id,
      feeRule.id,
      fee.toString(),
    ]
  )

  const reference = financialReference('job-pay')
  const [intentResult] = await conn.execute<ResultSetHeader>(
    `INSERT INTO marketplace_payment_intents (
       internal_reference, provider, booking_id, job_fund_id, client_uid,
       customer_email, amount_kobo, currency, status, purpose, metadata
     ) VALUES (?, 'paystack', ?, ?, ?, ?, ?, 'NGN', 'created', 'booking_funding', ?)`,
    [
      reference,
      input.bookingId,
      jobResult.insertId,
      input.clientUid,
      input.customerEmail.toLowerCase(),
      input.amountMinor.toString(),
      JSON.stringify({ bookingId: input.bookingId, actor: input.actor }),
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
      amountMinor: input.amountMinor.toString(),
      feeRuleId: feeRule.id,
    },
  })

  return {
    intentId: intentResult.insertId,
    jobFundId: jobResult.insertId,
    reference,
    amountMinor: toSafeDatabaseInteger(input.amountMinor),
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
      },
    })

    await updateInitializedPaymentIntent(input.intentId, provider.providerReference)
    return { authorizationUrl: provider.authorizationUrl, reference: input.reference }
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

    if (intent.status === 'succeeded') {
      await conn.commit()
      return { bookingId: intent.booking_id, credited: false }
    }
    if (!['created', 'initialized', 'pending'].includes(intent.status)) {
      throw new FinancialError('INVALID_STATE', `Payment cannot succeed from ${intent.status}`, 409)
    }

    validateIntentAgainstProvider(intent, verified)
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
        providerTransactionId: verified.providerTransactionId,
        paymentMethod: verified.paymentMethod,
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
    if (refundAfterCollection) {
      await requestJobRefundInTransaction(conn, {
        bookingId: intent.booking_id,
        requestedByUid: intent.client_uid,
        reason: 'Payment completed after booking cancellation was requested',
        actor: { type: 'system', id: 'late-payment-refund' },
      })
    } else {
      await conn.execute(
        `UPDATE bookings SET bookingStatus = 'Pending' WHERE bookingId = ?`,
        [intent.booking_id]
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
  const purposes =
    role === 'artisan'
      ? ['artisan_available_earnings', 'artisan_available_earnings']
      : ['client_refundable', 'client_available']
  const [balanceRow, stateRow, recipient, transactions] = await Promise.all([
    queryOne<(RowDataPacket & { balance: string | number })[]>(
      `SELECT COALESCE(SUM(balance_kobo), 0) AS balance
       FROM money_accounts
       WHERE owner_id = ? AND owner_type = ? AND purpose IN (?, ?) AND currency = 'NGN'`,
      [uid, role, purposes[0], purposes[1]]
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
        })[]>(
          `SELECT
             COALESCE(SUM(CASE WHEN status = 'refund_pending'
                               THEN expected_amount_kobo ELSE 0 END), 0) AS refundPending,
             COALESCE(SUM(locked_amount_kobo), 0) AS pending,
             0 AS totalEarned, 0 AS withdrawalPending, 0 AS totalWithdrawn,
             0 AS platformFees,
             COALESCE(SUM(funded_amount_kobo), 0) AS totalFunded,
             COALESCE(SUM(released_amount_kobo), 0) AS totalSpent
           FROM job_funds
           WHERE client_uid = ?`,
          [uid]
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
      withdrawalPendingBalance: Number(stateRow?.withdrawalPending ?? 0) / 100,
      totalWithdrawn: Number(stateRow?.totalWithdrawn ?? 0) / 100,
      platformFees: Number(stateRow?.platformFees ?? 0) / 100,
      totalFunded: Number(
        (stateRow as (typeof stateRow & { totalFunded?: string | number }))?.totalFunded ?? 0
      ) / 100,
      totalSpent: Number(
        (stateRow as (typeof stateRow & { totalSpent?: string | number }))?.totalSpent ?? 0
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
      return {
        id: `ledger-${transaction.id}`,
        type: walletTransactionType(transaction.transaction_type),
        amountNGN: Number(transaction.amount_kobo) / 100,
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

async function updateInitializedPaymentIntent(intentId: number, providerReference: string): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<PaymentIntentRow[]>(
      'SELECT * FROM marketplace_payment_intents WHERE id = ? FOR UPDATE',
      [intentId]
    )
    const intent = rows[0]
    if (!intent) throw new FinancialError('NOT_FOUND', 'Payment intent was not found', 404)
    if (intent.status === 'initialized' && intent.provider_reference === providerReference) {
      await conn.commit()
      return
    }
    assertTransition(paymentIntentTransitions, intent.status, 'initialized', 'Payment intent')
    await conn.execute(
      `UPDATE marketplace_payment_intents
       SET provider_reference = ?, status = 'initialized', initialized_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [providerReference, intentId]
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
  if (!Number.isSafeInteger(verified.amountMinor) || verified.amountMinor <= 0) {
    throw new FinancialError('INVALID_AMOUNT', 'Provider returned an invalid amount')
  }
}

function validateIntentAgainstProvider(
  intent: PaymentIntentRow,
  verified: PaymentVerificationResult
): void {
  if (minorFromDatabase(intent.amount_kobo) !== BigInt(verified.amountMinor)) {
    throw new FinancialError('INVALID_AMOUNT', 'Provider amount does not match the booking amount')
  }
  if (intent.currency !== verified.currency) {
    throw new FinancialError('CURRENCY_MISMATCH', 'Provider currency does not match the payment intent')
  }
  if (intent.customer_email.toLowerCase() !== verified.customerEmail.toLowerCase()) {
    throw new FinancialError('NOT_AUTHORIZED', 'Provider customer does not match the payment intent', 403)
  }
  if (
    verified.metadata.bookingId !== String(intent.booking_id) ||
    verified.metadata.clientUid !== intent.client_uid
  ) {
    throw new FinancialError('NOT_AUTHORIZED', 'Provider metadata does not match the payment intent', 403)
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
  if (type.includes('funding')) return 'job_payment'
  if (type.includes('earnings')) return 'earning'
  if (type.includes('refund')) return 'refund'
  if (type.includes('withdrawal')) return 'debit'
  return 'credit'
}

function readableTransactionType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export type { PaystackGateway }
