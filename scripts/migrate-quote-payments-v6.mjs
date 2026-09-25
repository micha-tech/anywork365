import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
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

const migrationName = '2026-09-24-quote-payment-terms'
const sql = readFileSync(resolve(scriptDirectory, 'migrations', `${migrationName}.sql`), 'utf8')
const checksum = createHash('sha256').update(sql).digest('hex')
const apply = process.argv.includes('--apply')

function databaseOptions() {
  const usePooler = process.env.MYSQL_USE_POOLER === 'true'
  let ssl
  if (process.env.MYSQL_SSL === 'skip-verify') ssl = { rejectUnauthorized: false }
  if (process.env.MYSQL_SSL === 'true') {
    const ca = process.env.MYSQL_CA_BASE64
      ? Buffer.from(process.env.MYSQL_CA_BASE64, 'base64').toString('utf8')
      : process.env.MYSQL_CA_PATH && existsSync(process.env.MYSQL_CA_PATH)
        ? readFileSync(process.env.MYSQL_CA_PATH, 'utf8')
        : undefined
    ssl = ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true }
  }
  return {
    host: usePooler ? process.env.MYSQL_POOLER_HOST || process.env.MYSQL_HOST : process.env.MYSQL_HOST,
    port: Number(usePooler ? process.env.MYSQL_POOLER_PORT || 33061 : process.env.MYSQL_PORT || 3306),
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
    const [existing] = await conn.execute(
      'SELECT checksum_sha256, applied_at FROM financial_schema_migrations WHERE migration_name = ?',
      [migrationName]
    )
    if (existing[0]) {
      if (existing[0].checksum_sha256 !== checksum) throw new Error('Applied migration checksum differs from the repository file')
      console.log(JSON.stringify({ status: 'already_applied', migrationName, checksum, appliedAt: existing[0].applied_at }, null, 2))
      return
    }

    const [columns] = await conn.query(
      `SELECT table_name, column_name, column_type, is_nullable FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND ((table_name = 'booking_quotes' AND column_name IN ('payment_option','upfront_amount'))
           OR (table_name = 'job_funds' AND column_name = 'installment_no'))`
    )
    let adoptExistingSchema = false
    if (columns.length > 0) {
      const [indexes] = await conn.query(
        `SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_list
         FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'job_funds'
           AND index_name IN ('uq_job_funds_booking','uq_job_funds_booking_installment')
         GROUP BY index_name`
      )
      const byColumn = new Map(columns.map((column) => [`${column.TABLE_NAME}.${column.COLUMN_NAME}`, column]))
      const paymentOption = byColumn.get('booking_quotes.payment_option')
      const upfront = byColumn.get('booking_quotes.upfront_amount')
      const installment = byColumn.get('job_funds.installment_no')
      const installmentIndex = indexes.find((index) => index.INDEX_NAME === 'uq_job_funds_booking_installment')
      const legacyIndex = indexes.find((index) => index.INDEX_NAME === 'uq_job_funds_booking')
      adoptExistingSchema = Boolean(
        paymentOption?.COLUMN_TYPE === "enum('full','part')" &&
        upfront?.COLUMN_TYPE === 'decimal(15,2)' && upfront?.IS_NULLABLE === 'NO' &&
        installment?.COLUMN_TYPE === 'tinyint unsigned' && installment?.IS_NULLABLE === 'NO' &&
        installmentIndex?.columns_list === 'booking_id,installment_no' &&
        !legacyIndex
      )
      if (!adoptExistingSchema) {
        throw new Error(`Partial v6 schema detected: ${JSON.stringify({ columns, indexes })}`)
      }
    }

    const [duplicates] = await conn.query(
      `SELECT COUNT(*) AS count FROM (
         SELECT booking_id FROM job_funds GROUP BY booking_id HAVING COUNT(*) > 1
       ) duplicate_funds`
    )
    if (Number(duplicates[0]?.count ?? 0) > 0) throw new Error('Existing duplicate job funds must be reconciled before v6')

    if (!apply) {
      console.log(JSON.stringify({
        status: adoptExistingSchema ? 'schema_present_unrecorded' : 'dry_run',
        migrationName,
        checksum,
        message: adoptExistingSchema
          ? 'The v6 schema is already present; apply will only register its checksum.'
          : 'No schema changes were made.',
      }, null, 2))
      return
    }

    const [lockRows] = await conn.query("SELECT GET_LOCK('anywork365-finance-migration', 10) AS acquired")
    locked = Number(lockRows[0]?.acquired) === 1
    if (!locked) throw new Error('Could not acquire the finance migration lock')
    if (!adoptExistingSchema) await conn.query(sql)
    await conn.execute(
      'INSERT INTO financial_schema_migrations (migration_name, checksum_sha256) VALUES (?, ?)',
      [migrationName, checksum]
    )
    console.log(JSON.stringify({ status: 'applied', migrationName, checksum }, null, 2))
  } finally {
    if (locked) await conn.query("SELECT RELEASE_LOCK('anywork365-finance-migration')").catch(() => undefined)
    await conn.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
