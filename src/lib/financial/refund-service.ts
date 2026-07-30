import type { RowDataPacket } from 'mysql2/promise'
import { execute, getConnection, queryOne } from '@/lib/db'
import { accounts } from './account-types'
import { getFinancialConfig } from './config'
import { FinancialError } from './errors'
import { LedgerService } from './ledger-service'
import { minorFromDatabase, toSafeDatabaseInteger } from './money-value'
import { paymentRail } from './paystack-gateway'
import type { PaymentRail } from './payment-rail'

type RefundRow = RowDataPacket & {
  id: number
  internal_reference: string
  job_fund_id: number
  requested_by_uid: string
  amount_kobo: string | number
  status: string
  provider_refund_reference: string | null
  client_uid: string
  booking_id: number
  payment_intent_id: number
  provider_transaction_id: string
  provider_reference: string
}

const ledger = new LedgerService()

export async function processRequestedRefunds(
  limit = 10,
  rail: PaymentRail = paymentRail
): Promise<{ submitted: number; review: number }> {
  const summary = { submitted: 0, review: 0 }
  for (let count = 0; count < limit; count += 1) {
    const refund = await claimRefund()
    if (!refund) break
    const status = await submitClaimedRefund(refund, rail)
    summary[status] += 1
  }
  return summary
}

export async function processRefundById(
  refundId: number,
  rail: PaymentRail = paymentRail
): Promise<{ status: 'submitted' | 'review'; providerReference: string | null }> {
  const refund = await claimRefund(refundId)
  if (!refund) {
    throw new FinancialError(
      'INVALID_STATE',
      'Only a requested refund can be submitted to Paystack',
      409
    )
  }
  const status = await submitClaimedRefund(refund, rail)
  const row = await queryOne<(RowDataPacket & { provider_refund_reference: string | null })[]>(
    'SELECT provider_refund_reference FROM refund_requests WHERE id = ?',
    [refundId]
  )
  return { status, providerReference: row?.provider_refund_reference ?? null }
}

export async function handleRefundProviderEvent(input: {
  eventType: string
  transactionReference: string
  refundReference: string | null
  amountMinor: string | number
  currency: string
  environment: string
}): Promise<void> {
  const config = getFinancialConfig()
  if (input.currency !== 'NGN' || input.environment !== config.PAYSTACK_ENVIRONMENT) {
    throw new FinancialError('CURRENCY_MISMATCH', 'Refund event environment or currency mismatch')
  }
  if (input.eventType === 'refund.pending' || input.eventType === 'refund.processing') {
    await execute(
      `UPDATE refund_requests rr
       JOIN marketplace_payment_intents mpi ON mpi.job_fund_id = rr.job_fund_id
       SET rr.status = 'processing',
           rr.provider_refund_reference = COALESCE(?, rr.provider_refund_reference)
       WHERE mpi.provider_reference = ? AND rr.status IN ('requested','approved','processing')`,
      [input.refundReference, input.transactionReference]
    )
    return
  }
  if (input.eventType === 'refund.needs-attention') {
    await execute(
      `UPDATE refund_requests rr
       JOIN marketplace_payment_intents mpi ON mpi.job_fund_id = rr.job_fund_id
       SET rr.status = 'needs_attention',
           rr.provider_refund_reference = COALESCE(?, rr.provider_refund_reference)
       WHERE mpi.provider_reference = ? AND rr.status <> 'completed'`,
      [input.refundReference, input.transactionReference]
    )
    return
  }
  if (input.eventType !== 'refund.processed' && input.eventType !== 'refund.failed') return

  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<RefundRow[]>(
      `SELECT rr.*, jf.client_uid, jf.booking_id, mpi.id AS payment_intent_id,
              mpi.provider_transaction_id, mpi.provider_reference
       FROM refund_requests rr
       JOIN job_funds jf ON jf.id = rr.job_fund_id
       JOIN marketplace_payment_intents mpi ON mpi.job_fund_id = jf.id
       WHERE mpi.provider_reference = ?
       ORDER BY rr.id DESC LIMIT 1 FOR UPDATE`,
      [input.transactionReference]
    )
    const refund = rows[0]
    if (!refund) throw new FinancialError('NOT_FOUND', 'Refund request was not found', 404)
    if (refund.status === 'completed' || refund.status === 'failed') {
      await conn.commit()
      return
    }
    const amount = minorFromDatabase(refund.amount_kobo)
    if (amount !== BigInt(String(input.amountMinor))) {
      throw new FinancialError('INVALID_AMOUNT', 'Refund event amount mismatch')
    }
    const processed = input.eventType === 'refund.processed'
    const posted = await ledger.postInTransaction(conn, {
      idempotencyKey: `refund-terminal:${refund.id}:${processed ? 'processed' : 'failed'}`,
      transactionType: processed ? 'provider_refund_completed' : 'provider_refund_failed',
      amountMinor: amount,
      userUid: refund.client_uid,
      bookingId: refund.booking_id,
      externalReference: input.refundReference ?? input.transactionReference,
      description: processed
        ? `Booking #${refund.booking_id} refund completed`
        : `Booking #${refund.booking_id} refund requires a new resolution`,
      actor: { type: 'provider', id: 'paystack' },
      entries: processed
        ? [
            { account: accounts.clientRefundPending(refund.client_uid), deltaMinor: -amount },
            { account: accounts.externalPaymentClearing(), deltaMinor: amount },
          ]
        : [
            { account: accounts.clientRefundPending(refund.client_uid), deltaMinor: -amount },
            { account: accounts.clientRefundable(refund.client_uid), deltaMinor: amount },
          ],
      metadata: { refundRequestId: refund.id, providerEvent: input.eventType },
      outbox: {
        eventType: processed ? 'refund.completed' : 'refund.failed',
        aggregateType: 'refund',
        aggregateId: String(refund.id),
        payload: { clientUid: refund.client_uid, amountMinor: amount.toString() },
      },
    })
    await conn.execute(
      `UPDATE refund_requests
       SET status = ?, provider_refund_reference = COALESCE(?, provider_refund_reference),
           ledger_transaction_id = ?, completed_at = ?
       WHERE id = ?`,
      [
        processed ? 'completed' : 'failed',
        input.refundReference,
        posted.id,
        processed ? new Date() : null,
        refund.id,
      ]
    )
    await conn.execute(
      `UPDATE job_funds
       SET status = ?, refunded_amount_kobo = ?, updated_at = NOW()
       WHERE id = ?`,
      [processed ? 'refunded' : 'disputed', processed ? amount.toString() : '0', refund.job_fund_id]
    )
    await conn.execute(
      `UPDATE marketplace_payment_intents
       SET status = ?, updated_at = NOW()
       WHERE id = ?`,
      [processed ? 'refunded' : 'succeeded', refund.payment_intent_id]
    )
    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

async function claimRefund(refundId?: number): Promise<RefundRow | null> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const idClause = refundId ? 'AND rr.id = ?' : ''
    const [rows] = await conn.execute<RefundRow[]>(
      `SELECT rr.*, jf.client_uid, jf.booking_id, mpi.id AS payment_intent_id,
              mpi.provider_transaction_id, mpi.provider_reference
       FROM refund_requests rr
       JOIN job_funds jf ON jf.id = rr.job_fund_id
       JOIN marketplace_payment_intents mpi ON mpi.job_fund_id = jf.id
       WHERE rr.status = 'requested' ${idClause}
       ORDER BY rr.id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      refundId ? [refundId] : []
    )
    const refund = rows[0]
    if (!refund) {
      await conn.commit()
      return null
    }
    await conn.execute(
      `UPDATE refund_requests SET status = 'processing' WHERE id = ?`,
      [refund.id]
    )
    await conn.commit()
    return refund
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

async function submitClaimedRefund(
  refund: RefundRow,
  rail: PaymentRail
): Promise<'submitted' | 'review'> {
  try {
    const provider = await rail.initiateRefund({
      transactionReference: refund.provider_transaction_id || refund.provider_reference,
      amountMinor: toSafeDatabaseInteger(minorFromDatabase(refund.amount_kobo)),
      currency: 'NGN',
    })
    await execute(
      `UPDATE refund_requests
       SET provider_refund_reference = ?, status = 'processing'
       WHERE id = ? AND status = 'processing'`,
      [provider.providerRefundReference, refund.id]
    )
    return 'submitted'
  } catch (error) {
    // Provider timeouts are ambiguous. Keep the ledger reservation intact.
    await execute(
      `UPDATE refund_requests SET status = 'needs_attention', reason = ?
       WHERE id = ? AND status = 'processing'`,
      [`Provider submission requires reconciliation: ${safeError(error)}`.slice(0, 500), refund.id]
    )
    return 'review'
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Provider refund submission failed'
}
