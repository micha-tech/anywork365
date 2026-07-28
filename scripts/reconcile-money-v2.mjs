import mysql from 'mysql2/promise'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({
  path: [
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '.env.production'),
    resolve(__dirname, '..', '.env'),
  ],
  quiet: true,
})

function options() {
  const usePooler = process.env.MYSQL_USE_POOLER === 'true'
  let ssl
  if (process.env.MYSQL_SSL === 'skip-verify') ssl = { rejectUnauthorized: false }
  if (process.env.MYSQL_SSL === 'true') {
    ssl = process.env.MYSQL_CA_PATH
      ? { ca: readFileSync(process.env.MYSQL_CA_PATH).toString() }
      : { rejectUnauthorized: true }
  }
  return {
    host: usePooler ? (process.env.MYSQL_POOLER_HOST || process.env.MYSQL_HOST) : process.env.MYSQL_HOST,
    port: Number(usePooler ? (process.env.MYSQL_POOLER_PORT || 33061) : (process.env.MYSQL_PORT || 3306)),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl,
  }
}

async function main() {
  const conn = await mysql.createConnection(options())
  const checks = []
  try {
    const [unbalanced] = await conn.query(
      `SELECT mt.reference, SUM(me.delta_kobo) AS imbalance_kobo
       FROM money_transactions mt
       JOIN money_entries me ON me.transaction_id = mt.id
       GROUP BY mt.id, mt.reference
       HAVING SUM(me.delta_kobo) <> 0`
    )
    checks.push({ name: 'balanced_transactions', ok: unbalanced.length === 0, issues: unbalanced.length })

    const [accountMismatch] = await conn.query(
      `SELECT ma.id, ma.owner_type, ma.owner_id, ma.purpose, ma.balance_kobo,
              COALESCE(SUM(me.delta_kobo), 0) AS calculated_kobo
       FROM money_accounts ma
       LEFT JOIN money_entries me ON me.account_id = ma.id
       GROUP BY ma.id
       HAVING ma.balance_kobo <> calculated_kobo`
    )
    checks.push({ name: 'stored_account_balances', ok: accountMismatch.length === 0, issues: accountMismatch.length })

    const [negativeProtected] = await conn.query(
      `SELECT id, owner_type, owner_id, purpose, balance_kobo
       FROM money_accounts
       WHERE purpose IN ('available', 'escrow', 'withdrawal_reserved', 'fees', 'chargeback_reserve')
         AND balance_kobo < 0`
    )
    checks.push({ name: 'nonnegative_protected_accounts', ok: negativeProtected.length === 0, issues: negativeProtected.length })

    const [escrowMismatch] = await conn.query(
      `SELECT be.booking_id, be.status, be.amount_kobo, ma.balance_kobo, b.bookingStatus
       FROM booking_escrows_v2 be
       JOIN money_accounts ma ON ma.id = be.escrow_account_id
       LEFT JOIN bookings b ON b.bookingId = be.booking_id
       WHERE (be.status = 'held' AND ma.balance_kobo <> be.amount_kobo)
          OR (be.status IN ('released', 'refunded') AND ma.balance_kobo <> 0)
          OR (be.status = 'released' AND b.bookingStatus <> 'Closed')
          OR (be.status = 'refunded' AND b.bookingStatus <> 'Cancelled')`
    )
    checks.push({ name: 'booking_escrow_state', ok: escrowMismatch.length === 0, issues: escrowMismatch.length })

    const [reservedMismatch] = await conn.query(
      `SELECT wr.user_uid,
              SUM(CASE WHEN wr.status IN ('reserved','submitted','processing','manual_review') THEN wr.amount_kobo ELSE 0 END) expected_kobo,
              COALESCE(ma.balance_kobo, 0) actual_kobo
       FROM withdrawal_requests_v2 wr
       LEFT JOIN money_accounts ma
         ON ma.owner_type = 'user' AND BINARY ma.owner_id = BINARY wr.user_uid
        AND ma.purpose = 'withdrawal_reserved' AND ma.currency = 'NGN'
       GROUP BY wr.user_uid, ma.balance_kobo
       HAVING expected_kobo <> actual_kobo`
    )
    checks.push({ name: 'withdrawal_reserves', ok: reservedMismatch.length === 0, issues: reservedMismatch.length })

    const [manualReview] = await conn.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount_kobo), 0) AS amount_kobo
       FROM withdrawal_requests_v2 WHERE status = 'manual_review'`
    )
    checks.push({
      name: 'manual_review_withdrawals',
      ok: Number(manualReview[0].count) === 0,
      issues: Number(manualReview[0].count),
      amountKobo: Number(manualReview[0].amount_kobo),
    })

    const [total] = await conn.query('SELECT COALESCE(SUM(balance_kobo), 0) AS imbalance_kobo FROM money_accounts')
    checks.push({
      name: 'global_ledger_balance',
      ok: Number(total[0].imbalance_kobo) === 0,
      issues: Number(total[0].imbalance_kobo) === 0 ? 0 : 1,
      imbalanceKobo: Number(total[0].imbalance_kobo),
    })

    const issueCount = checks.reduce((sum, check) => sum + check.issues, 0)
    const result = {
      status: issueCount === 0 ? 'passed' : 'attention_required',
      issueCount,
      checks,
      generatedAt: new Date().toISOString(),
    }

    if (process.argv.includes('--record')) {
      await conn.execute(
        `INSERT INTO money_reconciliation_runs (
           status, imbalance_kobo, issue_count, details, completed_at
         ) VALUES (?, ?, ?, ?, NOW())`,
        [
          result.status,
          Number(total[0].imbalance_kobo),
          issueCount,
          JSON.stringify(result),
        ]
      )
    }
    console.log(JSON.stringify(result, null, 2))
    if (issueCount > 0) process.exitCode = 2
  } finally {
    await conn.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
