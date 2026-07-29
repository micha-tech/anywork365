import { createHash, randomUUID } from 'crypto'
import type { RowDataPacket } from 'mysql2/promise'
import { execute, getConnection } from '@/lib/db'
import { getFinancialConfig } from './config'
import { confirmExternalPayment } from './marketplace-service'
import {
  confirmWalletFunding,
  isWalletFundingReference,
} from './wallet-funding-service'
import { reconcileMarketplaceWithdrawal } from './withdrawal-service'
import { handleRefundProviderEvent } from './refund-service'
import { recordProviderDispute } from './risk-service'

type ProviderEventRow = RowDataPacket & {
  id: number
  event_type: string
  provider_reference: string | null
  payload: string | Record<string, unknown>
  processing_attempts: number
}

export async function recordProviderEvent(input: {
  rawBody: string
  signature: string
}): Promise<{ duplicate: boolean; eventId: number | null }> {
  const parsed = JSON.parse(input.rawBody) as {
    event?: string
    id?: string | number
    data?: {
      id?: string | number
      reference?: string
      transfer_code?: string
      transaction?: { reference?: string }
    }
  }
  if (!parsed.event || typeof parsed.event !== 'string') {
    throw new Error('Provider event type is missing')
  }
  const hash = createHash('sha256').update(input.rawBody).digest('hex')
  const providerEventId = parsed.id ? String(parsed.id) : null
  const reference =
    parsed.data?.reference ||
    parsed.data?.transaction?.reference ||
    parsed.data?.transfer_code ||
    null

  const result = await execute(
    `INSERT INTO provider_events (
       provider, provider_event_id, event_type, provider_reference, payload,
       payload_hash, signature, signature_valid, processing_status, received_at
     ) VALUES ('paystack', ?, ?, ?, ?, ?, ?, 1, 'verified', NOW())
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [
      providerEventId,
      parsed.event,
      reference,
      input.rawBody,
      hash,
      input.signature.slice(0, 255),
    ]
  )
  return {
    duplicate: result.affectedRows !== 1,
    eventId: result.insertId ? Number(result.insertId) : null,
  }
}

export async function processProviderEvents(limit = 25): Promise<{
  processed: number
  failed: number
  deadLettered: number
}> {
  const summary = { processed: 0, failed: 0, deadLettered: 0 }
  for (let count = 0; count < limit; count += 1) {
    const event = await claimProviderEvent()
    if (!event) break
    try {
      const outcome = await dispatchProviderEvent(event)
      await execute(
        `UPDATE provider_events
         SET processing_status = ?, processed_at = NOW(),
             processing_token = NULL, last_error = NULL
         WHERE id = ?`,
        [outcome, event.id]
      )
      summary.processed += 1
    } catch (error) {
      const attempts = Number(event.processing_attempts) + 1
      const maxAttempts = getFinancialConfig().WEBHOOK_MAX_ATTEMPTS
      const dead = attempts >= maxAttempts
      const backoffMinutes = Math.min(360, 2 ** Math.min(attempts, 8))
      await execute(
        `UPDATE provider_events
         SET processing_status = ?,
             processing_token = NULL,
             next_attempt_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
             last_error = ?
         WHERE id = ?`,
        [
          dead ? 'dead_letter' : 'failed',
          backoffMinutes,
          safeError(error).slice(0, 1000),
          event.id,
        ]
      )
      if (dead) summary.deadLettered += 1
      else summary.failed += 1
    }
  }
  return summary
}

async function claimProviderEvent(): Promise<ProviderEventRow | null> {
  const conn = await getConnection()
  const token = randomUUID()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<ProviderEventRow[]>(
      `SELECT id, event_type, provider_reference, payload, processing_attempts
       FROM provider_events
       WHERE processing_status IN ('verified','failed')
         AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
       ORDER BY received_at, id
       LIMIT 1 FOR UPDATE SKIP LOCKED`
    )
    const event = rows[0]
    if (!event) {
      await conn.commit()
      return null
    }
    await conn.execute(
      `UPDATE provider_events
       SET processing_status = 'processing', processing_token = ?,
           processing_attempts = processing_attempts + 1,
           processing_started_at = NOW()
       WHERE id = ?`,
      [token, event.id]
    )
    await conn.commit()
    return event
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

async function dispatchProviderEvent(event: ProviderEventRow): Promise<'processed' | 'ignored'> {
  const payload =
    typeof event.payload === 'string'
      ? (JSON.parse(event.payload) as Record<string, unknown>)
      : event.payload
  const data = (payload.data ?? {}) as Record<string, unknown>

  if (event.event_type === 'charge.success') {
    const reference = String(data.reference ?? '')
    if (!reference) throw new Error('Successful charge event has no reference')
    if (await isWalletFundingReference(reference)) {
      await confirmWalletFunding(reference, { type: 'provider', id: 'paystack' })
    } else {
      await confirmExternalPayment(reference, { type: 'provider', id: 'paystack' })
    }
    return 'processed'
  }

  if (
    event.event_type === 'transfer.success' ||
    event.event_type === 'transfer.failed' ||
    event.event_type === 'transfer.reversed'
  ) {
    const reference = String(data.reference ?? '')
    if (!reference) throw new Error('Transfer event has no internal reference')
    await reconcileMarketplaceWithdrawal(reference, { type: 'provider', id: 'paystack' })
    return 'processed'
  }

  if (event.event_type.startsWith('refund.')) {
    await handleRefundProviderEvent({
      eventType: event.event_type,
      transactionReference: String(data.transaction_reference ?? ''),
      refundReference: data.refund_reference ? String(data.refund_reference) : null,
      amountMinor: String(data.amount ?? ''),
      currency: String(data.currency ?? ''),
      environment: String(data.domain ?? ''),
    })
    return 'processed'
  }

  if (event.event_type === 'charge.dispute.create') {
    const transaction = (data.transaction ?? {}) as Record<string, unknown>
    await recordProviderDispute({
      providerDisputeId: data.id ? String(data.id) : null,
      transactionReference: String(transaction.reference ?? data.reference ?? ''),
      amountMinor: String(data.amount ?? transaction.amount ?? ''),
      currency: String(data.currency ?? transaction.currency ?? ''),
      environment: String(data.domain ?? transaction.domain ?? ''),
      reason: data.reason ? String(data.reason) : undefined,
    })
    return 'processed'
  }

  // Transfer, refund, dispute and chargeback handlers are deliberately explicit.
  // Unknown events are retained and marked ignored through an audit-friendly no-op.
  return 'ignored'
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Provider event processing failed'
}
