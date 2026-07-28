import mysql from 'mysql2/promise'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
config({
  path: [
    resolve(scriptDirectory, '..', '.env.local'),
    resolve(scriptDirectory, '..', '.env.production'),
    resolve(scriptDirectory, '..', '.env'),
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
    const [table] = await conn.query("SHOW TABLES LIKE 'job_funds'")
    if (!table.length) throw new Error('Marketplace finance v3 schema is not installed')

    await check(conn, checks, 'balanced_posted_transactions', `
      SELECT mt.id, mt.reference, COALESCE(SUM(me.delta_kobo), 0) AS actual_amount_kobo
      FROM money_transactions mt
      LEFT JOIN money_entries me ON me.transaction_id = mt.id
      GROUP BY mt.id, mt.reference
      HAVING COUNT(me.id) < 2 OR SUM(me.delta_kobo) <> 0
    `)
    await check(conn, checks, 'cached_account_balances', `
      SELECT ma.id, ma.balance_kobo AS expected_amount_kobo,
             COALESCE(SUM(me.delta_kobo), 0) AS actual_amount_kobo
      FROM money_accounts ma
      LEFT JOIN money_entries me ON me.account_id = ma.id
      GROUP BY ma.id
      HAVING ma.balance_kobo <> actual_amount_kobo
    `)
    await check(conn, checks, 'protected_accounts_nonnegative', `
      SELECT ma.id, ma.owner_id AS user_uid, ma.balance_kobo AS actual_amount_kobo
      FROM money_accounts ma
      JOIN money_account_policies map ON map.account_id = ma.id
      WHERE map.allow_negative = 0 AND ma.balance_kobo < 0
    `)
    await check(conn, checks, 'job_fund_locked_projection', `
      SELECT jf.booking_id, jf.expected_amount_kobo, jf.locked_amount_kobo,
             ma.balance_kobo AS actual_amount_kobo, jf.status AS expected_status
      FROM job_funds jf
      JOIN money_accounts ma ON ma.id = jf.locked_account_id
      WHERE (jf.status = 'locked' AND (
               jf.locked_amount_kobo <> jf.expected_amount_kobo OR
               ma.balance_kobo <> jf.expected_amount_kobo
             ))
         OR (jf.status IN ('released','refund_pending','refunded','cancelled')
             AND jf.locked_amount_kobo <> 0)
    `)
    await check(conn, checks, 'payment_intent_ledger_link', `
      SELECT mpi.internal_reference, mpi.provider_reference,
             mpi.amount_kobo AS expected_amount_kobo, jf.funded_amount_kobo AS actual_amount_kobo
      FROM marketplace_payment_intents mpi
      JOIN job_funds jf ON jf.id = mpi.job_fund_id
      WHERE mpi.status = 'succeeded'
        AND (jf.funded_transaction_id IS NULL OR jf.funded_amount_kobo <> mpi.amount_kobo)
    `)
    await check(conn, checks, 'withdrawal_pending_projection', `
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
    await check(conn, checks, 'dead_letter_provider_events', `
      SELECT id, provider_reference, processing_status AS actual_status
      FROM provider_events WHERE processing_status = 'dead_letter'
    `)
    await check(conn, checks, 'stale_outbox_events', `
      SELECT id, aggregate_id AS internal_reference, status AS actual_status
      FROM financial_outbox_events
      WHERE status IN ('pending','processing','failed')
        AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
    `)

    const issueCount = checks.reduce((total, item) => total + item.issues.length, 0)
    const imbalance = checks
      .flatMap((item) => item.issues)
      .reduce((total, item) => total + Number(item.imbalance_kobo || 0), 0)
    const result = {
      status: issueCount === 0 ? 'passed' : 'attention_required',
      issueCount,
      checks: checks.map(({ name, issues }) => ({ name, ok: issues.length === 0, issueCount: issues.length })),
      generatedAt: new Date().toISOString(),
    }

    if (process.argv.includes('--record')) {
      const [run] = await conn.execute(
        `INSERT INTO money_reconciliation_runs (
           status, imbalance_kobo, issue_count, details, completed_at
         ) VALUES (?, ?, ?, ?, NOW())`,
        [result.status, imbalance, issueCount, JSON.stringify(result)]
      )
      for (const group of checks) {
        for (const issue of group.issues) {
          await conn.execute(
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
    }

    console.log(JSON.stringify(result, null, 2))
    if (issueCount > 0) process.exitCode = 2
  } finally {
    await conn.end()
  }
}

async function check(conn, checks, name, sql) {
  const [issues] = await conn.query(sql)
  checks.push({ name, issues })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
