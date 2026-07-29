import { randomUUID } from 'crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getConnection, queryOne } from '@/lib/db'
import { accounts } from './account-types'
import { getFinancialConfig } from './config'
import { FinancialError } from './errors'
import { LedgerService, type LedgerActor } from './ledger-service'
import { minorFromDatabase, toSafeDatabaseInteger, type MinorAmount } from './money-value'
import { paymentRail } from './paystack-gateway'
import type { PaymentRail, PaymentVerificationResult } from './payment-rail'

type WalletFundingIntentRow = RowDataPacket & {
  id: number
  internal_reference: string
  provider_reference: string | null
  client_uid: string
  customer_email: string
  requested_amount_kobo: string | number
  charged_amount_kobo: string | number | null
  credited_amount_kobo: string | number | null
  provider_fee_kobo: string | number
  currency: string
  status: string
  provider_transaction_id: string | null
  ledger_transaction_id: number | null
  receipt_number: string | null
  payment_method: string | null
  paid_at: Date | null
  confirmed_at: Date | null
  created_at: Date
}

export type WalletFundingConfirmation = {
  kind: 'wallet'
  reference: string
  receiptNumber: string
  creditedAmountMinor: number
  chargedAmountMinor: number
  providerFeeMinor: number
  providerTransactionId: string
  credited: boolean
}

export type WalletFundingReceipt = {
  receiptNumber: string
  reference: string
  providerTransactionId: string
  clientUid: string
  customerEmail: string
  currency: 'NGN'
  requestedAmountMinor: number
  chargedAmountMinor: number
  creditedAmountMinor: number
  providerFeeMinor: number
  paymentMethod: string | null
  paidAt: Date | null
  confirmedAt: Date | null
  createdAt: Date
  status: string
}

const ledger = new LedgerService()

export async function initializeWalletFunding(
  input: {
    clientUid: string
    customerEmail: string
    amountMinor: MinorAmount
    callbackUrl: string
  },
  rail: PaymentRail = paymentRail
): Promise<{ authorizationUrl: string; reference: string }> {
  if (input.amountMinor < BigInt(10_000) || input.amountMinor > BigInt(1_000_000_000)) {
    throw new FinancialError(
      'INVALID_AMOUNT',
      'Wallet funding must be between NGN 100 and NGN 10,000,000',
      400
    )
  }

  const reference = financialReference('wallet-fund')
  const conn = await getConnection()
  let intentId = 0
  try {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO wallet_funding_intents (
         internal_reference, provider, client_uid, customer_email,
         requested_amount_kobo, currency, status, metadata
       ) VALUES (?, 'paystack', ?, ?, ?, 'NGN', 'created', ?)`,
      [
        reference,
        input.clientUid,
        input.customerEmail.toLowerCase(),
        input.amountMinor.toString(),
        JSON.stringify({ type: 'wallet_funding', clientUid: input.clientUid }),
      ]
    )
    intentId = result.insertId
  } finally {
    conn.release()
  }

  try {
    const initialized = await rail.initializePayment({
      email: input.customerEmail,
      amountMinor: toSafeDatabaseInteger(input.amountMinor),
      currency: 'NGN',
      reference,
      callbackUrl: `${input.callbackUrl}${input.callbackUrl.includes('?') ? '&' : '?'}ref=${encodeURIComponent(reference)}`,
      metadata: {
        type: 'wallet_funding',
        clientUid: input.clientUid,
        walletFundingIntentId: String(intentId),
        creditedAmountMinor: input.amountMinor.toString(),
      },
    })
    await updateInitializedIntent(intentId, initialized.providerReference)
    return { authorizationUrl: initialized.authorizationUrl, reference }
  } catch (error) {
    await markInitializationFailed(intentId, safeError(error)).catch(() => undefined)
    throw error
  }
}

export async function confirmWalletFunding(
  reference: string,
  actor: LedgerActor,
  rail: PaymentRail = paymentRail
): Promise<WalletFundingConfirmation> {
  const verified = await rail.verifyPayment(reference)
  validateProviderPayment(verified)

  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<WalletFundingIntentRow[]>(
      `SELECT * FROM wallet_funding_intents
       WHERE internal_reference = ? OR (provider = ? AND provider_reference = ?)
       LIMIT 1 FOR UPDATE`,
      [reference, verified.provider, verified.reference]
    )
    const intent = rows[0]
    if (!intent) throw new FinancialError('NOT_FOUND', 'Wallet funding intent was not found', 404)
    if (actor.type === 'user' && actor.id !== intent.client_uid) {
      throw new FinancialError('NOT_AUTHORIZED', 'This payment belongs to another client', 403)
    }

    if (intent.status === 'succeeded') {
      const confirmation = confirmationFromIntent(intent, false)
      await conn.commit()
      return confirmation
    }
    if (!['created', 'initialized', 'pending'].includes(intent.status)) {
      throw new FinancialError(
        'INVALID_STATE',
        `Wallet funding cannot succeed from ${intent.status}`,
        409
      )
    }

    validateIntentAgainstProvider(intent, verified)
    const creditedAmount = minorFromDatabase(intent.requested_amount_kobo)
    const chargedAmount = BigInt(verified.amountMinor)
    const providerFee = BigInt(verified.providerFeeMinor)
    const feeRecovery = chargedAmount - creditedAmount
    const entries = [
      { account: accounts.externalPaymentClearing(), deltaMinor: -chargedAmount },
      { account: accounts.clientAvailable(intent.client_uid), deltaMinor: creditedAmount },
    ]
    if (feeRecovery > BigInt(0)) {
      entries.push({
        account: accounts.platformTransactionFeeRevenue(),
        deltaMinor: feeRecovery,
      })
    }
    if (providerFee > BigInt(0)) {
      entries.push(
        {
          account: accounts.platformPaymentProcessingExpense(),
          deltaMinor: providerFee,
        },
        {
          account: accounts.platformPaystackClearing(),
          deltaMinor: -providerFee,
        }
      )
    }

    const receiptNumber = makeReceiptNumber(intent.id)
    const posted = await ledger.postInTransaction(conn, {
      idempotencyKey: `paystack-wallet-funding:${verified.providerTransactionId}`,
      transactionType: 'wallet_funding_confirmed',
      amountMinor: creditedAmount,
      userUid: intent.client_uid,
      externalReference: verified.reference,
      description: 'Verified Paystack wallet funding',
      actor,
      entries,
      metadata: {
        walletFundingIntentId: intent.id,
        receiptNumber,
        providerTransactionId: verified.providerTransactionId,
        chargedMinor: chargedAmount.toString(),
        creditedMinor: creditedAmount.toString(),
        providerFeeMinor: providerFee.toString(),
        feeRecoveryMinor: feeRecovery.toString(),
        paymentMethod: verified.paymentMethod,
        gatewayResponse: verified.gatewayResponse,
        paidAt: verified.paidAt,
      },
      outbox: {
        eventType: 'wallet.funded',
        aggregateType: 'wallet_funding_intent',
        aggregateId: String(intent.id),
        payload: {
          clientUid: intent.client_uid,
          receiptNumber,
          creditedAmountMinor: creditedAmount.toString(),
        },
      },
    })

    await conn.execute(
      `UPDATE wallet_funding_intents
       SET provider_reference = ?, provider_transaction_id = ?,
           charged_amount_kobo = ?, credited_amount_kobo = ?,
           provider_fee_kobo = ?, payment_method = ?, status = 'succeeded',
           ledger_transaction_id = ?, receipt_number = ?,
           paid_at = ?, confirmed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [
        verified.reference,
        verified.providerTransactionId,
        chargedAmount.toString(),
        creditedAmount.toString(),
        providerFee.toString(),
        verified.paymentMethod,
        posted.id,
        receiptNumber,
        verified.paidAt ? new Date(verified.paidAt) : null,
        intent.id,
      ]
    )
    await conn.commit()
    return {
      kind: 'wallet',
      reference: intent.internal_reference,
      receiptNumber,
      creditedAmountMinor: toSafeDatabaseInteger(creditedAmount),
      chargedAmountMinor: verified.amountMinor,
      providerFeeMinor: verified.providerFeeMinor,
      providerTransactionId: verified.providerTransactionId,
      credited: !posted.idempotentReplay,
    }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function isWalletFundingReference(reference: string): Promise<boolean> {
  const row = await queryOne<(RowDataPacket & { id: number })[]>(
    `SELECT id FROM wallet_funding_intents
     WHERE internal_reference = ? OR provider_reference = ?
     LIMIT 1`,
    [reference, reference]
  )
  return Boolean(row)
}

export async function getWalletFundingReceipt(
  reference: string,
  clientUid: string
): Promise<WalletFundingReceipt | null> {
  const row = await queryOne<WalletFundingIntentRow[]>(
    `SELECT * FROM wallet_funding_intents
     WHERE (internal_reference = ? OR receipt_number = ?)
       AND client_uid = ? AND status = 'succeeded'
     LIMIT 1`,
    [reference, reference, clientUid]
  )
  return row ? receiptFromIntent(row) : null
}

function confirmationFromIntent(
  intent: WalletFundingIntentRow,
  credited: boolean
): WalletFundingConfirmation {
  if (
    !intent.receipt_number ||
    !intent.provider_transaction_id ||
    intent.credited_amount_kobo === null ||
    intent.charged_amount_kobo === null
  ) {
    throw new FinancialError('INVALID_STATE', 'Completed funding receipt is incomplete', 500)
  }
  return {
    kind: 'wallet',
    reference: intent.internal_reference,
    receiptNumber: intent.receipt_number,
    creditedAmountMinor: Number(intent.credited_amount_kobo),
    chargedAmountMinor: Number(intent.charged_amount_kobo),
    providerFeeMinor: Number(intent.provider_fee_kobo),
    providerTransactionId: intent.provider_transaction_id,
    credited,
  }
}

function receiptFromIntent(intent: WalletFundingIntentRow): WalletFundingReceipt {
  const confirmation = confirmationFromIntent(intent, false)
  return {
    receiptNumber: confirmation.receiptNumber,
    reference: confirmation.reference,
    providerTransactionId: confirmation.providerTransactionId,
    clientUid: intent.client_uid,
    customerEmail: intent.customer_email,
    currency: 'NGN',
    requestedAmountMinor: Number(intent.requested_amount_kobo),
    chargedAmountMinor: confirmation.chargedAmountMinor,
    creditedAmountMinor: confirmation.creditedAmountMinor,
    providerFeeMinor: confirmation.providerFeeMinor,
    paymentMethod: intent.payment_method,
    paidAt: intent.paid_at,
    confirmedAt: intent.confirmed_at,
    createdAt: intent.created_at,
    status: intent.status,
  }
}

async function updateInitializedIntent(intentId: number, providerReference: string): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.execute(
      `UPDATE wallet_funding_intents
       SET provider_reference = ?, status = 'initialized',
           initialized_at = NOW(), updated_at = NOW()
       WHERE id = ? AND status = 'created'`,
      [providerReference, intentId]
    )
  } finally {
    conn.release()
  }
}

async function markInitializationFailed(intentId: number, reason: string): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.execute(
      `UPDATE wallet_funding_intents
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

function validateIntentAgainstProvider(
  intent: WalletFundingIntentRow,
  verified: PaymentVerificationResult
): void {
  const expected = minorFromDatabase(intent.requested_amount_kobo)
  if (expected !== BigInt(verified.requestedAmountMinor)) {
    throw new FinancialError('INVALID_AMOUNT', 'Provider requested amount does not match the funding intent')
  }
  if (verified.amountMinor < verified.requestedAmountMinor) {
    throw new FinancialError('INVALID_AMOUNT', 'Provider charged less than the wallet credit')
  }
  if (intent.currency !== verified.currency) {
    throw new FinancialError('CURRENCY_MISMATCH', 'Provider currency does not match the funding intent')
  }
  if (intent.customer_email.toLowerCase() !== verified.customerEmail.toLowerCase()) {
    throw new FinancialError('NOT_AUTHORIZED', 'Provider customer does not match the funding intent', 403)
  }
  if (
    verified.metadata.type !== 'wallet_funding' ||
    verified.metadata.clientUid !== intent.client_uid ||
    verified.metadata.walletFundingIntentId !== String(intent.id)
  ) {
    throw new FinancialError('NOT_AUTHORIZED', 'Provider metadata does not match the funding intent', 403)
  }
  if (verified.reference !== intent.internal_reference) {
    throw new FinancialError('NOT_AUTHORIZED', 'Provider reference does not match the funding intent', 403)
  }
  if (!verified.providerTransactionId) {
    throw new FinancialError('INVALID_STATE', 'Provider transaction ID is missing', 409)
  }
}

function financialReference(prefix: string): string {
  return `${prefix}-${randomUUID()}`.slice(0, 50)
}

function makeReceiptNumber(intentId: number): string {
  return `AW365-FUND-${String(intentId).padStart(10, '0')}`
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Provider request failed'
}
