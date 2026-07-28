import { randomUUID } from 'crypto'
import type { RowDataPacket } from 'mysql2/promise'
import { execute, getConnection } from '@/lib/db'
import { createDbNotification } from '@/lib/queries'

type OutboxRow = RowDataPacket & {
  id: number
  event_type: string
  aggregate_type: string
  aggregate_id: string
  payload: string | Record<string, unknown>
  attempt_count: number
}

export async function processFinancialOutbox(limit = 50): Promise<{
  delivered: number
  failed: number
}> {
  const summary = { delivered: 0, failed: 0 }
  for (let count = 0; count < limit; count += 1) {
    const event = await claimOutboxEvent()
    if (!event) break
    try {
      await deliver(event)
      await execute(
        `UPDATE financial_outbox_events
         SET status = 'delivered', delivered_at = NOW(), processing_token = NULL,
             last_error = NULL
         WHERE id = ?`,
        [event.id]
      )
      summary.delivered += 1
    } catch (error) {
      const attempts = Number(event.attempt_count) + 1
      const dead = attempts >= 10
      await execute(
        `UPDATE financial_outbox_events
         SET status = ?, processing_token = NULL,
             available_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
             last_error = ?
         WHERE id = ?`,
        [
          dead ? 'dead_letter' : 'failed',
          Math.min(360, 2 ** Math.min(attempts, 8)),
          safeError(error).slice(0, 1000),
          event.id,
        ]
      )
      summary.failed += 1
    }
  }
  return summary
}

async function claimOutboxEvent(): Promise<OutboxRow | null> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<OutboxRow[]>(
      `SELECT id, event_type, aggregate_type, aggregate_id, payload, attempt_count
       FROM financial_outbox_events
       WHERE status IN ('pending','failed') AND available_at <= NOW()
       ORDER BY available_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`
    )
    const row = rows[0]
    if (!row) {
      await conn.commit()
      return null
    }
    await conn.execute(
      `UPDATE financial_outbox_events
       SET status = 'processing', processing_token = ?,
           processing_started_at = NOW(), attempt_count = attempt_count + 1
       WHERE id = ?`,
      [randomUUID(), row.id]
    )
    await conn.commit()
    return row
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

async function deliver(event: OutboxRow): Promise<void> {
  const payload =
    typeof event.payload === 'string'
      ? (JSON.parse(event.payload) as Record<string, unknown>)
      : event.payload
  const userUid = String(payload.artisanUid ?? payload.clientUid ?? '')
  if (!userUid) return

  const messages: Record<string, string> = {
    'job.funded': `Booking #${String(payload.bookingId)} has been paid and is ready for your response.`,
    'earnings.held': `Earnings for booking #${String(payload.bookingId)} are pending the safety hold.`,
    'earnings.available': 'Your marketplace earnings are now available for withdrawal.',
    'withdrawal.success': 'Your withdrawal was completed successfully.',
    'withdrawal.failed': 'Your withdrawal could not be completed and the funds were returned.',
    'refund.completed': 'Your booking refund has been completed.',
  }
  const message = messages[event.event_type]
  if (!message) return

  const inserted = await execute(
    `INSERT INTO financial_notifications (
       user_uid, notification_type, aggregate_type, aggregate_id, payload, status
     ) VALUES (?, ?, ?, ?, ?, 'pending')
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [
      userUid,
      event.event_type,
      event.aggregate_type,
      event.aggregate_id,
      JSON.stringify({ message }),
    ]
  )
  if (inserted.affectedRows === 1) {
    await createDbNotification(userUid, message)
    await execute(
      `UPDATE financial_notifications SET status = 'sent', sent_at = NOW()
       WHERE id = ?`,
      [inserted.insertId]
    )
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Outbox delivery failed'
}
