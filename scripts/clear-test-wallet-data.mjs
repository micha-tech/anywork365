import mysql from 'mysql2/promise'
import { config } from 'dotenv'
import { createCipheriv, randomBytes } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
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

const apply = process.argv.includes('--apply')
const confirmed = process.argv.includes('--confirm-clear-wallet-test-data')
const candidateTables = [
  'payment_webhook_events',
  'money_reconciliation_runs',
  'money_rate_limits',
  'money_entries',
  'booking_escrows_v2',
  'withdrawal_requests_v2',
  'funding_intents',
  'money_transactions',
  'money_accounts',
  'wallet_escrow',
  'withdrawals',
  'withdrawal_accounts',
  'wallet_ledger',
  'wallet_transactions',
  'wallets',
]

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

async function existingTables(conn) {
  const placeholders = candidateTables.map(() => '?').join(',')
  const [rows] = await conn.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = ? AND table_name IN (${placeholders})`,
    [process.env.MYSQL_DATABASE, ...candidateTables]
  )
  return new Set(rows.map((row) => row.TABLE_NAME || row.table_name))
}

async function tableRows(conn, table) {
  const [rows] = await conn.query(`SELECT * FROM \`${table}\``)
  return rows
}

function encryptBackup(payload) {
  const key = randomBytes(32)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload, null, 2), 'utf8'),
    cipher.final(),
  ])
  return {
    encrypted: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]),
    key: key.toString('hex'),
  }
}

async function main() {
  if (apply && !confirmed) {
    throw new Error('Refusing to clear data without --confirm-clear-wallet-test-data')
  }

  const conn = await mysql.createConnection(databaseOptions())
  try {
    const present = await existingTables(conn)
    const backup = {
      createdAt: new Date().toISOString(),
      database: process.env.MYSQL_DATABASE,
      tables: {},
      affectedHeldBookings: [],
    }

    for (const table of candidateTables) {
      if (present.has(table)) backup.tables[table] = await tableRows(conn, table)
    }

    if (present.has('wallet_escrow')) {
      const [rows] = await conn.query(
        `SELECT b.*
         FROM bookings b
         JOIN wallet_escrow we ON we.booking_id = b.bookingId
         WHERE we.status = 'held'`
      )
      backup.affectedHeldBookings.push(...rows)
    }
    if (present.has('booking_escrows_v2')) {
      const [rows] = await conn.query(
        `SELECT b.*
         FROM bookings b
         JOIN booking_escrows_v2 be ON be.booking_id = b.bookingId
         WHERE be.status = 'held'`
      )
      const knownIds = new Set(backup.affectedHeldBookings.map((row) => row.bookingId))
      backup.affectedHeldBookings.push(...rows.filter((row) => !knownIds.has(row.bookingId)))
    }

    const countsBefore = Object.fromEntries(
      Object.entries(backup.tables).map(([table, rows]) => [table, rows.length])
    )
    if (!apply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        countsBefore,
        heldBookingsToCancel: backup.affectedHeldBookings.map((row) => row.bookingId),
      }, null, 2))
      return
    }

    const backupDirectory = resolve(scriptDirectory, '..', 'backups', 'wallet-clears')
    mkdirSync(backupDirectory, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupBase = resolve(backupDirectory, `wallet-test-data-${timestamp}`)
    const encrypted = encryptBackup(backup)
    writeFileSync(`${backupBase}.json.enc`, encrypted.encrypted)
    writeFileSync(`${backupBase}.key`, `${encrypted.key}\n`, { mode: 0o600 })

    await conn.beginTransaction()
    if (present.has('booking_escrows_v2')) {
      await conn.execute(
        `UPDATE bookings b
         JOIN booking_escrows_v2 be ON be.booking_id = b.bookingId
         SET b.bookingStatus = 'Cancelled',
             b.reasonForCancellation = 'Test wallet data cleared by administrator'
         WHERE be.status = 'held'
           AND b.bookingStatus NOT IN ('Closed', 'Cancelled')`
      )
    }
    if (present.has('wallet_escrow')) {
      await conn.execute(
        `UPDATE bookings b
         JOIN wallet_escrow we ON we.booking_id = b.bookingId
         SET b.bookingStatus = 'Cancelled',
             b.reasonForCancellation = 'Test wallet data cleared by administrator'
         WHERE we.status = 'held'
           AND b.bookingStatus NOT IN ('Closed', 'Cancelled')`
      )
    }

    for (const table of candidateTables) {
      if (present.has(table)) await conn.execute(`DELETE FROM \`${table}\``)
    }
    await conn.commit()

    const countsAfter = {}
    for (const table of candidateTables) {
      if (!present.has(table)) continue
      const [rows] = await conn.query(`SELECT COUNT(*) AS count FROM \`${table}\``)
      countsAfter[table] = Number(rows[0].count)
    }
    const remaining = Object.values(countsAfter).reduce((sum, count) => sum + count, 0)
    if (remaining !== 0) throw new Error(`Wallet cleanup verification failed: ${remaining} rows remain`)

    console.log(JSON.stringify({
      mode: 'applied',
      countsBefore,
      countsAfter,
      cancelledHeldBookings: backup.affectedHeldBookings.map((row) => row.bookingId),
      backup: `${backupBase}.json.enc`,
      key: `${backupBase}.key`,
    }, null, 2))
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    await conn.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
