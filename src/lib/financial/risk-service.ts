import { randomUUID } from 'crypto'
import type { RowDataPacket } from 'mysql2/promise'
import { getConnection } from '@/lib/db'
import { accounts } from './account-types'
import { getFinancialConfig } from './config'
import { FinancialError } from './errors'
import { LedgerService } from './ledger-service'
import { minorFromDatabase } from './money-value'

type DisputeContext = RowDataPacket & {
  payment_intent_id: number
  job_fund_id: number
  booking_id: number
  client_uid: string
  artisan_uid: string
  expected_amount_kobo: string | number
  platform_fee_kobo: string | number
  release_transaction_id: number | null
  job_status: string
}

const ledger = new LedgerService()

export async function recordProviderDispute(input: {
  providerDisputeId: string | null
  transactionReference: string
  amountMinor: string | number
  currency: string
  environment: string
  reason?: string
}): Promise<{ disputeId: number; heldMinor: string; duplicate: boolean }> {
  const config = getFinancialConfig()
  if (input.currency !== 'NGN' || input.environment !== config.PAYSTACK_ENVIRONMENT) {
    throw new FinancialError('CURRENCY_MISMATCH', 'Dispute event environment or currency mismatch')
  }
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    if (input.providerDisputeId) {
      const [existing] = await conn.execute<(RowDataPacket & { id: number })[]>(
        `SELECT id FROM financial_disputes
         WHERE provider = 'paystack' AND provider_dispute_id = ? FOR UPDATE`,
        [input.providerDisputeId]
      )
      if (existing[0]) {
        await conn.commit()
        return { disputeId: existing[0].id, heldMinor: '0', duplicate: true }
      }
    }
    const context = await disputeContext(conn, input.transactionReference)
    const gross = minorFromDatabase(context.expected_amount_kobo)
    if (gross !== BigInt(String(input.amountMinor))) {
      throw new FinancialError('INVALID_AMOUNT', 'Dispute amount does not match the booking payment')
    }
    const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
      `INSERT INTO financial_disputes (
         provider, provider_dispute_id, payment_intent_id, job_fund_id,
         amount_kobo, currency, status, reason
       ) VALUES ('paystack', ?, ?, ?, ?, 'NGN', 'open', ?)`,
      [
        input.providerDisputeId,
        context.payment_intent_id,
        context.job_fund_id,
        gross.toString(),
        (input.reason || 'Provider dispute opened').slice(0, 500),
      ]
    )

    let held = BigInt(0)
    if (context.release_transaction_id) {
      const pending = await ledger.ensureAccountInTransaction(
        conn,
        accounts.artisanPendingEarnings(context.artisan_uid)
      )
      const available = await ledger.ensureAccountInTransaction(
        conn,
        accounts.artisanAvailableEarnings(context.artisan_uid)
      )
      const reserve = await ledger.ensureAccountInTransaction(
        conn,
        accounts.artisanReserveHold(context.artisan_uid)
      )
      const [balances] = await conn.execute<(RowDataPacket & {
        id: number
        balance_kobo: string | number
      })[]>(
        `SELECT id, balance_kobo FROM money_accounts
         WHERE id IN (?, ?, ?) ORDER BY id FOR UPDATE`,
        [pending.id, available.id, reserve.id]
      )
      const balanceById = new Map(
        balances.map((row) => [Number(row.id), BigInt(String(row.balance_kobo))])
      )
      const net = gross - minorFromDatabase(context.platform_fee_kobo)
      const fromPending = min(balanceById.get(Number(pending.id)) ?? BigInt(0), net)
      const fromAvailable = min(
        balanceById.get(Number(available.id)) ?? BigInt(0),
        net - fromPending
      )
      held = fromPending + fromAvailable
      if (held > BigInt(0)) {
        await ledger.postInTransaction(conn, {
          idempotencyKey: `dispute-hold:${result.insertId}`,
          transactionType: 'earnings_risk_hold',
          amountMinor: held,
          userUid: context.artisan_uid,
          bookingId: context.booking_id,
          externalReference: input.providerDisputeId ?? undefined,
          description: `Earnings held while booking #${context.booking_id} is disputed`,
          actor: { type: 'provider', id: 'paystack' },
          entries: [
            ...(fromPending > BigInt(0)
              ? [{ account: accounts.artisanPendingEarnings(context.artisan_uid), deltaMinor: -fromPending }]
              : []),
            ...(fromAvailable > BigInt(0)
              ? [{ account: accounts.artisanAvailableEarnings(context.artisan_uid), deltaMinor: -fromAvailable }]
              : []),
            { account: accounts.artisanReserveHold(context.artisan_uid), deltaMinor: held },
          ],
          metadata: { disputeId: result.insertId, fromPending: fromPending.toString() },
          outbox: {
            eventType: 'earnings.risk_hold',
            aggregateType: 'dispute',
            aggregateId: String(result.insertId),
            payload: { artisanUid: context.artisan_uid, amountMinor: held.toString() },
          },
        })
      }
      await conn.execute(
        `INSERT INTO risk_holds (
           user_uid, account_id, amount_kobo, reason_code, reason, status,
           source_type, source_id, created_by_uid
         ) VALUES (?, ?, ?, 'provider_dispute', ?, 'active', 'financial_dispute', ?, 'paystack')`,
        [
          context.artisan_uid,
          reserve.id,
          held.toString(),
          (input.reason || 'Provider dispute opened').slice(0, 500),
          String(result.insertId),
        ]
      )
    }
    await conn.execute(
      `UPDATE job_funds SET status = 'disputed', updated_at = NOW() WHERE id = ?`,
      [context.job_fund_id]
    )
    await conn.commit()
    return { disputeId: result.insertId, heldMinor: held.toString(), duplicate: false }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function recordChargeback(
  disputeId: number,
  actorId: string
): Promise<{ chargebackReference: string; duplicate: boolean }> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [existing] = await conn.execute<(RowDataPacket & { internal_reference: string })[]>(
      'SELECT internal_reference FROM financial_chargebacks WHERE dispute_id = ? FOR UPDATE',
      [disputeId]
    )
    if (existing[0]) {
      await conn.commit()
      return { chargebackReference: existing[0].internal_reference, duplicate: true }
    }
    const [rows] = await conn.execute<(DisputeContext & {
      dispute_amount_kobo: string | number
    })[]>(
      `SELECT mpi.id AS payment_intent_id, jf.id AS job_fund_id, jf.booking_id,
              jf.client_uid, jf.artisan_uid, jf.expected_amount_kobo,
              jf.platform_fee_kobo, jf.release_transaction_id, jf.status AS job_status,
              fd.amount_kobo AS dispute_amount_kobo
       FROM financial_disputes fd
       JOIN job_funds jf ON jf.id = fd.job_fund_id
       JOIN marketplace_payment_intents mpi ON mpi.id = fd.payment_intent_id
       WHERE fd.id = ? FOR UPDATE`,
      [disputeId]
    )
    const context = rows[0]
    if (!context) throw new FinancialError('NOT_FOUND', 'Dispute was not found', 404)
    const gross = minorFromDatabase(context.dispute_amount_kobo)
    const reference = `chargeback-${randomUUID()}`.slice(0, 50)
    let entries
    if (!context.release_transaction_id) {
      entries = [
        { account: accounts.clientLockedJobFunds(context.booking_id), deltaMinor: -gross },
        { account: accounts.externalPaymentClearing(), deltaMinor: gross },
      ]
    } else {
      const [holdRows] = await conn.execute<(RowDataPacket & { amount_kobo: string | number })[]>(
        `SELECT amount_kobo FROM risk_holds
         WHERE source_type = 'financial_dispute' AND source_id = ? AND status = 'active'
         FOR UPDATE`,
        [String(disputeId)]
      )
      const held = minorFromDatabase(holdRows[0]?.amount_kobo ?? 0)
      const fee = minorFromDatabase(context.platform_fee_kobo)
      const shortfall = gross - held - fee
      entries = [
        { account: accounts.externalPaymentClearing(), deltaMinor: gross },
        ...(held > BigInt(0)
          ? [{ account: accounts.artisanReserveHold(context.artisan_uid), deltaMinor: -held }]
          : []),
        ...(fee > BigInt(0)
          ? [{ account: accounts.platformCommissionRevenue(), deltaMinor: -fee }]
          : []),
        ...(shortfall > BigInt(0)
          ? [{ account: accounts.platformOperationalReserve(), deltaMinor: -shortfall }]
          : []),
      ]
    }
    const posted = await ledger.postInTransaction(conn, {
      reference,
      idempotencyKey: `chargeback:${disputeId}`,
      transactionType: 'provider_chargeback',
      amountMinor: gross,
      userUid: context.artisan_uid,
      bookingId: context.booking_id,
      description: `Chargeback recorded for booking #${context.booking_id}`,
      actor: { type: 'admin', id: actorId },
      entries,
      metadata: { disputeId },
      outbox: {
        eventType: 'chargeback.recorded',
        aggregateType: 'dispute',
        aggregateId: String(disputeId),
        payload: { artisanUid: context.artisan_uid, amountMinor: gross.toString() },
      },
    })
    await conn.execute(
      `INSERT INTO financial_chargebacks (
         dispute_id, internal_reference, amount_kobo, currency, status, ledger_transaction_id
       ) VALUES (?, ?, ?, 'NGN', 'recorded', ?)`,
      [disputeId, reference, gross.toString(), posted.id]
    )
    await conn.execute(
      `UPDATE financial_disputes SET status = 'lost', resolved_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [disputeId]
    )
    await conn.execute(
      `UPDATE marketplace_payment_intents SET status = 'chargeback', updated_at = NOW()
       WHERE id = ?`,
      [context.payment_intent_id]
    )
    await conn.execute(
      `UPDATE risk_holds SET status = 'consumed' WHERE source_type = 'financial_dispute'
       AND source_id = ? AND status = 'active'`,
      [String(disputeId)]
    )
    await conn.commit()
    return { chargebackReference: reference, duplicate: posted.idempotentReplay }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

async function disputeContext(
  conn: import('mysql2/promise').PoolConnection,
  transactionReference: string
): Promise<DisputeContext> {
  const [rows] = await conn.execute<DisputeContext[]>(
    `SELECT mpi.id AS payment_intent_id, jf.id AS job_fund_id, jf.booking_id,
            jf.client_uid, jf.artisan_uid, jf.expected_amount_kobo,
            jf.platform_fee_kobo, jf.release_transaction_id, jf.status AS job_status
     FROM marketplace_payment_intents mpi
     JOIN job_funds jf ON jf.id = mpi.job_fund_id
     WHERE mpi.provider_reference = ? OR mpi.provider_transaction_id = ?
     LIMIT 1 FOR UPDATE`,
    [transactionReference, transactionReference]
  )
  if (!rows[0]) throw new FinancialError('NOT_FOUND', 'Disputed payment was not found', 404)
  return rows[0]
}

function min(left: bigint, right: bigint): bigint {
  return left < right ? left : right
}
