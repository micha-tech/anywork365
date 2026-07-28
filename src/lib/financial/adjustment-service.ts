import { randomUUID } from 'crypto'
import type { ResultSetHeader } from 'mysql2/promise'
import { getConnection } from '@/lib/db'
import { accounts } from './account-types'
import { LedgerService } from './ledger-service'
import type { MinorAmount } from './money-value'

const ledger = new LedgerService()

export async function createFinancialAdjustment(input: {
  targetUserUid: string
  target: 'client_refundable' | 'artisan_available_earnings'
  direction: 'credit' | 'debit'
  amountMinor: MinorAmount
  reason: string
  ticketReference: string
  idempotencyKey: string
  adminUid: string
}): Promise<{ reference: string; idempotentReplay: boolean }> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const targetAccount =
      input.target === 'client_refundable'
        ? accounts.clientRefundable(input.targetUserUid)
        : accounts.artisanAvailableEarnings(input.targetUserUid)
    const signed = input.direction === 'credit' ? input.amountMinor : -input.amountMinor
    const posted = await ledger.postInTransaction(conn, {
      idempotencyKey: input.idempotencyKey,
      transactionType: 'financial_adjustment',
      amountMinor: input.amountMinor,
      userUid: input.targetUserUid,
      description: input.reason,
      actor: { type: 'admin', id: input.adminUid },
      entries: [
        { account: targetAccount, deltaMinor: signed },
        { account: accounts.adjustment(), deltaMinor: -signed },
      ],
      metadata: {
        targetAccountType: input.target,
        direction: input.direction,
        ticketReference: input.ticketReference,
      },
      outbox: {
        eventType: 'financial.adjustment',
        aggregateType: 'user',
        aggregateId: input.targetUserUid,
        payload: { clientUid: input.targetUserUid, amountMinor: input.amountMinor.toString() },
      },
    })
    const reference = posted.reference || `adjustment-${randomUUID()}`.slice(0, 50)
    await conn.execute<ResultSetHeader>(
      `INSERT INTO financial_adjustments (
         internal_reference, target_user_uid, target_account_type, direction,
         amount_kobo, currency, reason, ticket_reference, ledger_transaction_id,
         created_by_uid
       ) VALUES (?, ?, ?, ?, ?, 'NGN', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [
        reference,
        input.targetUserUid,
        input.target,
        input.direction,
        input.amountMinor.toString(),
        input.reason.slice(0, 500),
        input.ticketReference.slice(0, 160),
        posted.id,
        input.adminUid,
      ]
    )
    await conn.commit()
    return { reference, idempotentReplay: posted.idempotentReplay }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}
