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

function databaseOptions() {
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

async function count(conn, sql) {
  const [rows] = await conn.query(sql)
  return Number(rows[0]?.issue_count || 0)
}

async function main() {
  const conn = await mysql.createConnection(databaseOptions())
  try {
    await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await conn.query('SET TRANSACTION READ ONLY')
    await conn.beginTransaction()

    const checks = []
    checks.push({
      name: 'negative_user_wallets',
      issues: await count(conn, `
        SELECT COUNT(*) AS issue_count FROM (
          SELECT w.id
          FROM wallets w
          LEFT JOIN wallet_ledger wl ON wl.wallet_id = w.id
          WHERE w.wallet_type = 'user'
          GROUP BY w.id
          HAVING COALESCE(SUM(CASE WHEN wl.direction = 'credit' THEN wl.amount ELSE -wl.amount END), 0) < 0
        ) negative_wallets
      `),
    })
    checks.push({
      name: 'orphan_wallet_entries',
      issues: await count(conn, `
        SELECT COUNT(*) AS issue_count
        FROM wallet_ledger wl
        LEFT JOIN wallets w ON w.id = wl.wallet_id
        WHERE w.id IS NULL
      `),
    })
    checks.push({
      name: 'duplicate_booking_escrows',
      issues: await count(conn, `
        SELECT COUNT(*) AS issue_count FROM (
          SELECT booking_id
          FROM wallet_escrow
          GROUP BY booking_id
          HAVING COUNT(*) > 1
        ) duplicate_escrows
      `),
    })
    checks.push({
      name: 'active_bookings_without_held_escrow',
      issues: await count(conn, `
        SELECT COUNT(*) AS issue_count
        FROM bookings b
        LEFT JOIN wallet_escrow we
          ON we.booking_id = b.bookingId AND we.status = 'held'
        WHERE b.bookingStatus IN ('Pending', 'Confirmed')
          AND b.priceConfirmed = 1
          AND b.amountAgreed > 0
          AND we.id IS NULL
      `),
    })
    checks.push({
      name: 'held_escrows_for_terminal_bookings',
      issues: await count(conn, `
        SELECT COUNT(*) AS issue_count
        FROM wallet_escrow we
        JOIN bookings b ON b.bookingId = we.booking_id
        WHERE we.status = 'held'
          AND b.bookingStatus IN ('Closed', 'Cancelled')
      `),
    })
    checks.push({
      name: 'pending_withdrawals_without_recipient',
      issues: await count(conn, `
        SELECT COUNT(*) AS issue_count
        FROM withdrawals wr
        LEFT JOIN withdrawal_accounts wa ON wa.id = wr.account_id
        WHERE wr.status IN ('pending', 'processing')
          AND (wa.id IS NULL OR wa.recipient_code IS NULL OR wa.recipient_code = '')
      `),
    })
    checks.push({
      name: 'invalid_pending_withdrawal_amounts',
      issues: await count(conn, `
        SELECT COUNT(*) AS issue_count
        FROM withdrawals
        WHERE status IN ('pending', 'processing') AND amount <= 0
      `),
    })

    await conn.rollback()
    const issueCount = checks.reduce((total, check) => total + check.issues, 0)
    const result = {
      status: issueCount === 0 ? 'ready' : 'blocked',
      issueCount,
      checks: checks.map((check) => ({ ...check, ok: check.issues === 0 })),
      generatedAt: new Date().toISOString(),
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
