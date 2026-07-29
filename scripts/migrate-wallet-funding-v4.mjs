import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'
import { config } from 'dotenv'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
config({
  path: [
    resolve(scriptDirectory, '..', '.env.local'),
    resolve(scriptDirectory, '..', '.env.production'),
    resolve(scriptDirectory, '..', '.env'),
  ],
  quiet: true,
})

const migrationName = '2026-07-29-wallet-funding-v4'
const migrationPath = resolve(scriptDirectory, 'migrations', `${migrationName}.sql`)
const sql = readFileSync(migrationPath, 'utf8')
const checksum = createHash('sha256').update(sql).digest('hex')
const apply = process.argv.includes('--apply')

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
    multipleStatements: true,
  }
}

async function main() {
  const conn = await mysql.createConnection(databaseOptions())
  let locked = false
  try {
    const [prerequisites] = await conn.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name IN (
           'money_accounts','money_transactions','money_entries',
           'money_account_policies','financial_schema_migrations'
         )`
    )
    const present = new Set(prerequisites.map((row) => row.TABLE_NAME || row.table_name))
    const required = [
      'money_accounts',
      'money_transactions',
      'money_entries',
      'money_account_policies',
      'financial_schema_migrations',
    ]
    const missing = required.filter((name) => !present.has(name))
    if (missing.length) throw new Error(`Missing prerequisites: ${missing.join(', ')}`)

    const [existing] = await conn.execute(
      `SELECT checksum_sha256, applied_at
       FROM financial_schema_migrations WHERE migration_name = ?`,
      [migrationName]
    )
    if (existing[0]) {
      if (existing[0].checksum_sha256 !== checksum) {
        throw new Error('Applied migration checksum differs from the repository file')
      }
      console.log(JSON.stringify({
        status: 'already_applied',
        migrationName,
        checksum,
        appliedAt: existing[0].applied_at,
      }, null, 2))
      return
    }

    if (!apply) {
      console.log(JSON.stringify({
        status: 'dry_run',
        migrationName,
        checksum,
        bytes: Buffer.byteLength(sql),
        prerequisites: [...present].sort(),
        message: 'No schema changes were made. Re-run with --apply after backup and change approval.',
      }, null, 2))
      return
    }

    const [lockRows] = await conn.query(`SELECT GET_LOCK('anywork365-finance-migration', 10) AS acquired`)
    locked = Number(lockRows[0]?.acquired) === 1
    if (!locked) throw new Error('Could not acquire the finance migration lock')
    await conn.query(sql)
    await conn.execute(
      `INSERT INTO financial_schema_migrations (migration_name, checksum_sha256)
       VALUES (?, ?)`,
      [migrationName, checksum]
    )
    console.log(JSON.stringify({
      status: 'applied',
      migrationName,
      checksum,
      reminder: 'Verify wallet funding in Paystack test mode before enabling live traffic.',
    }, null, 2))
  } finally {
    if (locked) await conn.query(`SELECT RELEASE_LOCK('anywork365-finance-migration')`).catch(() => undefined)
    await conn.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
