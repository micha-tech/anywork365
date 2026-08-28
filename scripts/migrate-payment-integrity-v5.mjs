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

const migrationName = '2026-08-28-payment-integrity-v5'
const migrationPath = resolve(scriptDirectory, 'migrations', `${migrationName}.sql`)
const sql = readFileSync(migrationPath, 'utf8')
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

async function scalar(conn, sqlText) {
  const [rows] = await conn.query(sqlText)
  return Number(rows[0]?.count || 0)
}

async function schemaObjectExists(conn, query, params) {
  const [rows] = await conn.execute(query, params)
  return rows.length > 0
}

async function runDdl(conn, step, statement) {
  try {
    await conn.query(statement)
  } catch (error) {
    const [warnings] = await conn.query('SHOW WARNINGS').catch(() => [[]])
    console.error(JSON.stringify({ status: 'ddl_failed', step, warnings }, null, 2))
    throw error
  }
}

async function resumePaymentAccountTail(conn) {
  const columnExists = (columnName) => schemaObjectExists(
    conn,
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'booking_payment_accounts'
       AND column_name = ? LIMIT 1`,
    [columnName]
  )
  const indexExists = (indexName) => schemaObjectExists(
    conn,
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'booking_payment_accounts'
       AND index_name = ? LIMIT 1`,
    [indexName]
  )
  const constraintExists = (constraintName) => schemaObjectExists(
    conn,
    `SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = DATABASE() AND table_name = 'booking_payment_accounts'
       AND constraint_name = ? LIMIT 1`,
    [constraintName]
  )

  const [paymentColumns] = await conn.query(
    `SELECT column_name, is_nullable, collation_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'booking_payment_accounts'
       AND column_name IN ('marketplace_payment_intent_id', 'client_uid', 'currency')`
  )
  const byName = new Map(paymentColumns.map((column) => [column.COLUMN_NAME, column]))
  if (
    byName.get('marketplace_payment_intent_id')?.IS_NULLABLE !== 'NO' ||
    byName.get('client_uid')?.COLLATION_NAME !== 'utf8mb4_general_ci' ||
    byName.get('currency')?.COLLATION_NAME !== 'utf8mb4_general_ci'
  ) {
    await runDdl(conn, 'normalize_booking_payment_account_columns', `
      ALTER TABLE booking_payment_accounts
        MODIFY COLUMN marketplace_payment_intent_id BIGINT UNSIGNED NOT NULL,
        MODIFY COLUMN client_uid VARCHAR(128)
          CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
        MODIFY COLUMN currency CHAR(3)
          CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'NGN'
    `)
  }
  if (!(await columnExists('active_booking_id'))) {
    await runDdl(conn, 'add_active_booking_generated_column', `
      ALTER TABLE booking_payment_accounts
        ADD COLUMN active_booking_id INT
          GENERATED ALWAYS AS (
            CASE WHEN status = 'active' THEN booking_id ELSE NULL END
          ) VIRTUAL
    `)
  }
  if (!(await indexExists('uq_booking_payment_intent'))) {
    await runDdl(conn, 'add_unique_payment_intent_index', `
      ALTER TABLE booking_payment_accounts
        ADD UNIQUE KEY uq_booking_payment_intent (marketplace_payment_intent_id)
    `)
  }
  if (!(await indexExists('uq_booking_payment_one_active'))) {
    await runDdl(conn, 'add_unique_active_booking_index', `
      ALTER TABLE booking_payment_accounts
        ADD UNIQUE KEY uq_booking_payment_one_active (active_booking_id)
    `)
  }
  if (!(await constraintExists('fk_booking_payment_intent_link'))) {
    await runDdl(conn, 'add_booking_payment_intent_link', `
      ALTER TABLE booking_payment_accounts
        ADD CONSTRAINT fk_booking_payment_intent_link
          FOREIGN KEY (
            marketplace_payment_intent_id, booking_id, quote_id,
            client_uid, amount_kobo, currency
          ) REFERENCES marketplace_payment_intents (
            id, booking_id, quote_id, client_uid, amount_kobo, currency
          ) ON DELETE RESTRICT ON UPDATE RESTRICT
    `)
  }

  const [quoteRules] = await conn.execute(
    `SELECT delete_rule, update_rule
     FROM information_schema.referential_constraints
     WHERE constraint_schema = DATABASE()
       AND table_name = 'booking_payment_accounts'
       AND constraint_name = 'fk_booking_payment_quote'`,
  )
  if (quoteRules[0]?.DELETE_RULE !== 'RESTRICT' || quoteRules[0]?.UPDATE_RULE !== 'RESTRICT') {
    if (await constraintExists('fk_booking_payment_quote')) {
      await runDdl(conn, 'drop_legacy_booking_payment_quote_fk', `
        ALTER TABLE booking_payment_accounts
          DROP FOREIGN KEY fk_booking_payment_quote
      `)
    }
    await runDdl(conn, 'add_restrict_booking_payment_quote_fk', `
      ALTER TABLE booking_payment_accounts
        ADD CONSTRAINT fk_booking_payment_quote
          FOREIGN KEY (quote_id) REFERENCES booking_quotes (id)
          ON DELETE RESTRICT ON UPDATE RESTRICT
    `)
  }
}

async function main() {
  const conn = await mysql.createConnection(databaseOptions())
  let locked = false
  try {
    const required = [
      'financial_schema_migrations',
      'bookings',
      'businesses',
      'booking_quotes',
      'booking_payment_accounts',
      'job_funds',
      'marketplace_payment_intents',
    ]
    const [tables] = await conn.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN (${required.map(() => '?').join(',')})`,
      required
    )
    const present = new Set(tables.map((row) => row.TABLE_NAME || row.table_name))
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

    const checks = {
      paymentAccountsWithoutIntent: await scalar(conn, `
        SELECT COUNT(*) AS count
        FROM booking_payment_accounts bpa
        LEFT JOIN marketplace_payment_intents mpi
          ON mpi.id = bpa.marketplace_payment_intent_id
        WHERE bpa.marketplace_payment_intent_id IS NULL OR mpi.id IS NULL
      `),
      duplicatePaymentAccountsPerIntent: await scalar(conn, `
        SELECT COUNT(*) AS count FROM (
          SELECT marketplace_payment_intent_id
          FROM booking_payment_accounts
          GROUP BY marketplace_payment_intent_id HAVING COUNT(*) > 1
        ) duplicates
      `),
      multipleActiveAccountsPerBooking: await scalar(conn, `
        SELECT COUNT(*) AS count FROM (
          SELECT booking_id FROM booking_payment_accounts
          WHERE status = 'active'
          GROUP BY booking_id HAVING COUNT(*) > 1
        ) duplicates
      `),
      paymentIntentsWithoutAcceptedQuote: await scalar(conn, `
        SELECT COUNT(*) AS count
        FROM marketplace_payment_intents mpi
        LEFT JOIN booking_quotes q
          ON q.booking_id = mpi.booking_id AND q.status = 'accepted'
        WHERE q.id IS NULL
      `),
      relationalMismatches: await scalar(conn, `
        SELECT COUNT(*) AS count
        FROM booking_payment_accounts bpa
        JOIN marketplace_payment_intents mpi
          ON mpi.id = bpa.marketplace_payment_intent_id
        JOIN job_funds jf ON jf.id = mpi.job_fund_id
        JOIN booking_quotes q ON q.id = bpa.quote_id
        WHERE bpa.booking_id <> mpi.booking_id
           OR bpa.quote_id <> q.id
           OR q.booking_id <> mpi.booking_id
           OR BINARY bpa.client_uid <> BINARY mpi.client_uid
           OR BINARY mpi.client_uid <> BINARY jf.client_uid
           OR bpa.amount_kobo <> mpi.amount_kobo
           OR mpi.amount_kobo <> jf.expected_amount_kobo
      `),
    }
    const issueCount = Object.values(checks).reduce((sum, value) => sum + value, 0)
    if (issueCount > 0) {
      throw new Error(`Payment integrity preflight failed: ${JSON.stringify(checks)}`)
    }

    if (!apply) {
      console.log(JSON.stringify({
        status: 'dry_run',
        migrationName,
        checksum,
        bytes: Buffer.byteLength(sql),
        checks,
        message: 'No schema changes were made. Apply before deploying code that uses v5 columns.',
      }, null, 2))
      return
    }

    const [lockRows] = await conn.query(
      `SELECT GET_LOCK('anywork365-finance-migration', 10) AS acquired`
    )
    locked = Number(lockRows[0]?.acquired) === 1
    if (!locked) throw new Error('Could not acquire the finance migration lock')

    const partialV5 = await schemaObjectExists(
      conn,
      `SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema = DATABASE()
         AND table_name = 'marketplace_payment_intents'
         AND constraint_name = 'fk_marketplace_payment_job_link'
       LIMIT 1`,
      []
    )
    if (partialV5) {
      const requiredPartialObjects = [
        ['booking_quotes', 'uq_booking_quote_relational'],
        ['job_funds', 'fk_job_fund_quote_link'],
        ['job_funds', 'uq_job_fund_payment_link'],
        ['marketplace_payment_intents', 'uq_marketplace_payment_provider_tx'],
        ['marketplace_payment_intents', 'uq_marketplace_payment_link'],
      ]
      for (const [tableName, objectName] of requiredPartialObjects) {
        const present = await schemaObjectExists(
          conn,
          `SELECT 1 FROM information_schema.table_constraints
           WHERE table_schema = DATABASE() AND table_name = ?
             AND constraint_name = ? LIMIT 1`,
          [tableName, objectName]
        )
        if (!present) {
          throw new Error(`Unsafe partial v5 state: missing ${tableName}.${objectName}`)
        }
      }
      await resumePaymentAccountTail(conn)
    } else {
      await conn.query(sql)
    }
    await conn.execute(
      `INSERT INTO financial_schema_migrations (migration_name, checksum_sha256)
       VALUES (?, ?)`,
      [migrationName, checksum]
    )
    console.log(JSON.stringify({ status: 'applied', migrationName, checksum }, null, 2))
  } finally {
    if (locked) {
      await conn.query(`SELECT RELEASE_LOCK('anywork365-finance-migration')`).catch(() => undefined)
    }
    await conn.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
