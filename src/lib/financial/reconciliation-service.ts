import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { getConnection } from '@/lib/db'

type ReconciliationCheck = {
  name: string
  issues: RowDataPacket[]
}

export type FinancialReconciliationResult = {
  status: 'passed' | 'attention_required'
  issueCount: number
  checks: Array<{ name: string; ok: boolean; issueCount: number }>
  generatedAt: string
}

export async function runFinancialReconciliation(
  record = true
): Promise<FinancialReconciliationResult> {
  const connection = await getConnection()
  const checks: ReconciliationCheck[] = []
  try {
    await check(connection, checks, 'balanced_posted_transactions', `
      SELECT mt.id, mt.reference, COALESCE(SUM(me.delta_kobo), 0) AS actual_amount_kobo
      FROM money_transactions mt
      LEFT JOIN money_entries me ON me.transaction_id = mt.id
      GROUP BY mt.id, mt.reference
      HAVING COUNT(me.id) < 2 OR SUM(me.delta_kobo) <> 0
    `)
    await check(connection, checks, 'cached_account_balances', `
      SELECT ma.id, ma.balance_kobo AS expected_amount_kobo,
             COALESCE(SUM(me.delta_kobo), 0) AS actual_amount_kobo
      FROM money_accounts ma
      LEFT JOIN money_entries me ON me.account_id = ma.id
      GROUP BY ma.id
      HAVING ma.balance_kobo <> actual_amount_kobo
    `)
    await check(connection, checks, 'protected_accounts_nonnegative', `
      SELECT ma.id, ma.owner_id AS user_uid, ma.balance_kobo AS actual_amount_kobo
      FROM money_accounts ma
      JOIN money_account_policies map ON map.account_id = ma.id
      WHERE map.allow_negative = 0 AND ma.balance_kobo < 0
    `)
    await check(connection, checks, 'job_fund_locked_projection', `
      SELECT jf.booking_id, jf.expected_amount_kobo, jf.locked_amount_kobo,
             ma.balance_kobo AS actual_amount_kobo, jf.status AS expected_status
      FROM job_funds jf
      JOIN money_accounts ma ON ma.id = jf.locked_account_id
      WHERE (jf.status = 'locked' AND (
               jf.locked_amount_kobo <> jf.expected_amount_kobo OR
               ma.balance_kobo <> jf.expected_amount_kobo
             ))
         OR (jf.status IN ('released','refund_pending','refunded','cancelled')
             AND (jf.locked_amount_kobo <> 0 OR ma.balance_kobo <> 0))
    `)
    await check(connection, checks, 'wallet_funding_receipt_and_ledger_link', `
      SELECT wfi.internal_reference, wfi.provider_reference, wfi.client_uid AS user_uid,
             wfi.requested_amount_kobo AS expected_amount_kobo,
             wfi.credited_amount_kobo AS actual_amount_kobo,
             wfi.status AS actual_status
      FROM wallet_funding_intents wfi
      LEFT JOIN money_transactions mt ON mt.id = wfi.ledger_transaction_id
      WHERE wfi.status = 'succeeded'
        AND (
          wfi.provider_transaction_id IS NULL OR
          wfi.receipt_number IS NULL OR
          wfi.ledger_transaction_id IS NULL OR
          wfi.credited_amount_kobo <> wfi.requested_amount_kobo OR
          mt.transaction_type <> 'wallet_funding_confirmed'
        )
    `)
    await check(connection, checks, 'booking_payment_relational_chain', `
      SELECT mpi.id AS internal_reference, mpi.provider_reference, mpi.booking_id,
             mpi.amount_kobo AS expected_amount_kobo,
             bpa.amount_kobo AS actual_amount_kobo
      FROM marketplace_payment_intents mpi
      JOIN job_funds jf ON jf.id = mpi.job_fund_id
      JOIN bookings b ON b.bookingId = mpi.booking_id
      JOIN businesses bus ON bus.businessId = b.businessId
      JOIN booking_quotes q ON q.id = mpi.quote_id
      LEFT JOIN booking_payment_accounts bpa
        ON bpa.marketplace_payment_intent_id = mpi.id
      WHERE mpi.booking_id <> jf.booking_id
         OR mpi.quote_id <> jf.quote_id
         OR mpi.quote_id <> q.id
         OR q.booking_id <> mpi.booking_id
         OR BINARY mpi.client_uid <> BINARY jf.client_uid
         OR BINARY mpi.client_uid <> BINARY b.clientUID
         OR BINARY jf.artisan_uid <> BINARY q.artisan_uid
         OR BINARY jf.artisan_uid <> BINARY bus.uid
         OR mpi.amount_kobo <> jf.expected_amount_kobo
         OR mpi.amount_kobo <> ROUND(q.amount * 100)
         OR mpi.amount_kobo <> ROUND(b.amountAgreed * 100)
         OR (
           mpi.status IN (
             'initialized','pending','succeeded','refunded',
             'partially_refunded','chargeback'
           ) AND bpa.id IS NULL
         )
         OR (
           bpa.id IS NOT NULL AND (
             bpa.booking_id <> mpi.booking_id OR
             bpa.quote_id <> mpi.quote_id OR
             BINARY bpa.client_uid <> BINARY mpi.client_uid OR
             bpa.amount_kobo <> mpi.amount_kobo OR
             BINARY bpa.currency <> BINARY mpi.currency OR
             BINARY bpa.provider <> BINARY mpi.provider OR
             BINARY bpa.provider_reference <> BINARY mpi.provider_reference
           )
         )
    `)
    await check(connection, checks, 'succeeded_booking_payment_completeness', `
      SELECT mpi.id AS internal_reference, mpi.provider_reference, mpi.booking_id,
             mpi.amount_kobo AS expected_amount_kobo,
             mt.amount_kobo AS actual_amount_kobo
      FROM marketplace_payment_intents mpi
      JOIN job_funds jf ON jf.id = mpi.job_fund_id
      LEFT JOIN money_transactions mt ON mt.id = jf.funded_transaction_id
      LEFT JOIN booking_payment_accounts bpa
        ON bpa.marketplace_payment_intent_id = mpi.id AND bpa.status = 'paid'
      WHERE mpi.status = 'succeeded'
        AND (
          mpi.provider_transaction_id IS NULL OR
          jf.status NOT IN ('locked','released','refund_pending','refunded','disputed') OR
          mt.id IS NULL OR
          mt.transaction_type <> 'job_funding_confirmed' OR
          mt.booking_id <> mpi.booking_id OR
          mt.amount_kobo <> mpi.amount_kobo OR
          bpa.id IS NULL
        )
    `)
    await check(connection, checks, 'multiple_active_booking_payment_accounts', `
      SELECT booking_id, COUNT(*) AS actual_amount_kobo
      FROM booking_payment_accounts
      WHERE status = 'active'
      GROUP BY booking_id
      HAVING COUNT(*) > 1
    `)
    await check(connection, checks, 'verified_wallet_funding_release_coverage', `
      SELECT released.client_uid AS user_uid,
             verified.verified_amount_kobo AS expected_amount_kobo,
             released.released_amount_kobo AS actual_amount_kobo
      FROM (
        SELECT jf.client_uid, COALESCE(SUM(jf.expected_amount_kobo), 0) AS released_amount_kobo
        FROM job_funds jf
        JOIN money_transactions funding_tx
          ON funding_tx.id = jf.funded_transaction_id
         AND funding_tx.transaction_type = 'job_wallet_funds_locked'
         AND funding_tx.status = 'success'
        WHERE jf.status = 'released'
        GROUP BY jf.client_uid
      ) released
      LEFT JOIN (
        SELECT wfi.client_uid,
               COALESCE(SUM(wfi.credited_amount_kobo), 0) AS verified_amount_kobo
        FROM wallet_funding_intents wfi
        JOIN money_transactions funding_tx
          ON funding_tx.id = wfi.ledger_transaction_id
         AND funding_tx.transaction_type = 'wallet_funding_confirmed'
         AND funding_tx.status = 'success'
        WHERE wfi.status = 'succeeded'
          AND wfi.provider_transaction_id IS NOT NULL
          AND wfi.receipt_number IS NOT NULL
          AND wfi.credited_amount_kobo = wfi.requested_amount_kobo
        GROUP BY wfi.client_uid
      ) verified ON BINARY verified.client_uid = BINARY released.client_uid
      WHERE released.released_amount_kobo > COALESCE(verified.verified_amount_kobo, 0)
    `)
    await check(connection, checks, 'withdrawal_pending_projection', `
      SELECT wr.artisan_uid AS user_uid,
             SUM(CASE WHEN wr.status IN ('requested','under_review','approved','processing')
                      THEN wr.amount_kobo ELSE 0 END) AS expected_amount_kobo,
             COALESCE(ma.balance_kobo, 0) AS actual_amount_kobo
      FROM marketplace_withdrawal_requests wr
      LEFT JOIN money_accounts ma
        ON ma.owner_type = 'artisan' AND BINARY ma.owner_id = BINARY wr.artisan_uid
       AND ma.purpose = 'artisan_withdrawal_pending'
      GROUP BY wr.artisan_uid, ma.balance_kobo
      HAVING expected_amount_kobo <> actual_amount_kobo
    `)
    await check(connection, checks, 'dead_letter_provider_events', `
      SELECT id, provider_reference, processing_status AS actual_status
      FROM provider_events WHERE processing_status = 'dead_letter'
    `)
    await check(connection, checks, 'stale_processing_provider_events', `
      SELECT id, provider_reference, processing_status AS actual_status
      FROM provider_events
      WHERE processing_status = 'processing'
        AND processing_started_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
    `)
    await check(connection, checks, 'stale_outbox_events', `
      SELECT id, aggregate_id AS internal_reference, status AS actual_status
      FROM financial_outbox_events
      WHERE status IN ('pending','processing','failed')
        AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
    `)

    const issueCount = checks.reduce((total, item) => total + item.issues.length, 0)
    const result: FinancialReconciliationResult = {
      status: issueCount === 0 ? 'passed' : 'attention_required',
      issueCount,
      checks: checks.map(({ name, issues }) => ({
        name,
        ok: issues.length === 0,
        issueCount: issues.length,
      })),
      generatedAt: new Date().toISOString(),
    }

    if (record) await recordResult(connection, result, checks)
    return result
  } finally {
    connection.release()
  }
}

async function check(
  connection: PoolConnection,
  checks: ReconciliationCheck[],
  name: string,
  sql: string
): Promise<void> {
  const [issues] = await connection.query<RowDataPacket[]>(sql)
  checks.push({ name, issues })
}

async function recordResult(
  connection: PoolConnection,
  result: FinancialReconciliationResult,
  checks: ReconciliationCheck[]
): Promise<void> {
  await connection.beginTransaction()
  try {
    const [run] = await connection.execute<import('mysql2/promise').ResultSetHeader>(
      `INSERT INTO money_reconciliation_runs (
         status, imbalance_kobo, issue_count, details, completed_at
       ) VALUES (?, 0, ?, ?, NOW())`,
      [result.status, result.issueCount, JSON.stringify(result)]
    )
    for (const group of checks) {
      for (const issue of group.issues) {
        await connection.execute(
          `INSERT INTO reconciliation_items (
             reconciliation_run_id, mismatch_type, severity, internal_reference,
             provider_reference, user_uid, booking_id, expected_amount_kobo,
             actual_amount_kobo, expected_status, actual_status
           ) VALUES (?, ?, 'error', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            run.insertId,
            group.name,
            issue.internal_reference || issue.reference || null,
            issue.provider_reference || null,
            issue.user_uid || null,
            issue.booking_id || null,
            issue.expected_amount_kobo ?? null,
            issue.actual_amount_kobo ?? null,
            issue.expected_status || null,
            issue.actual_status || null,
          ]
        )
      }
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  }
}
