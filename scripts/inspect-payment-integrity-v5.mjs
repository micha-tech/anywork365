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
  }
}

const tables = [
  'booking_quotes',
  'job_funds',
  'marketplace_payment_intents',
  'booking_payment_accounts',
]
const connection = await mysql.createConnection(databaseOptions())
try {
  const [columns] = await connection.query(
    `SELECT table_name, column_name, column_type, is_nullable,
            character_set_name, collation_name, generation_expression
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name IN (?)
       AND column_name IN (
         'id', 'booking_id', 'quote_id', 'job_fund_id',
         'marketplace_payment_intent_id', 'artisan_uid', 'client_uid',
         'amount_kobo', 'expected_amount_kobo', 'currency',
         'initiated_request_id', 'initiated_session_fingerprint',
         'active_booking_id'
       )
     ORDER BY table_name, ordinal_position`,
    [tables]
  )
  const [indexes] = await connection.query(
    `SELECT table_name, index_name, non_unique,
            GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_list
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name IN (?)
     GROUP BY table_name, index_name, non_unique
     ORDER BY table_name, index_name`,
    [tables]
  )
  const [constraints] = await connection.query(
    `SELECT table_name, constraint_name, constraint_type
     FROM information_schema.table_constraints
     WHERE table_schema = DATABASE() AND table_name IN (?)
     ORDER BY table_name, constraint_name`,
    [tables]
  )
  const [triggers] = await connection.query(
    `SELECT trigger_name, event_object_table, action_timing, event_manipulation
     FROM information_schema.triggers
     WHERE trigger_schema = DATABASE()
       AND trigger_name IN ('fill_job_fund_payment_context', 'fill_payment_intent_context')
     ORDER BY trigger_name`
  )
  const [migration] = await connection.execute(
    `SELECT migration_name, checksum_sha256, applied_at
     FROM financial_schema_migrations
     WHERE migration_name = ?`,
    ['2026-08-28-payment-integrity-v5']
  )
  const [mismatches] = await connection.query(
    `SELECT
       SUM(bpa.booking_id <> mpi.booking_id) AS booking_id_mismatches,
       SUM(bpa.quote_id <> mpi.quote_id) AS quote_id_mismatches,
       SUM(BINARY bpa.client_uid <> BINARY mpi.client_uid) AS client_uid_mismatches,
       SUM(bpa.amount_kobo <> mpi.amount_kobo) AS amount_mismatches,
       SUM(BINARY bpa.currency <> BINARY mpi.currency) AS currency_mismatches
     FROM booking_payment_accounts bpa
     JOIN marketplace_payment_intents mpi
       ON mpi.id = bpa.marketplace_payment_intent_id`
  )
  const [engineStatusRows] = await connection.query('SHOW ENGINE INNODB STATUS')
  const engineStatus = engineStatusRows[0]?.Status || ''
  const foreignKeyError = engineStatus.includes('LATEST FOREIGN KEY ERROR')
    ? engineStatus
        .split('LATEST FOREIGN KEY ERROR')[1]
        .split('------------')[0]
        .trim()
    : null
  const [foreignKeys] = await connection.query(
    `SELECT kcu.constraint_name, kcu.column_name,
            kcu.referenced_table_name, kcu.referenced_column_name,
            rc.delete_rule, rc.update_rule
     FROM information_schema.key_column_usage kcu
     JOIN information_schema.referential_constraints rc
       ON rc.constraint_schema = kcu.constraint_schema
      AND rc.constraint_name = kcu.constraint_name
      AND rc.table_name = kcu.table_name
     WHERE kcu.constraint_schema = DATABASE()
       AND kcu.table_name = 'booking_payment_accounts'
       AND kcu.referenced_table_name IS NOT NULL
     ORDER BY kcu.constraint_name, kcu.ordinal_position`
  )
  const [referencedColumns] = await connection.query(
    `SELECT table_name, column_name, column_type, is_nullable,
            character_set_name, collation_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND (table_name, column_name) IN (
         ('bookings', 'id'),
         ('booking_quotes', 'id')
       )
     ORDER BY table_name, column_name`
  )
  const [[createPaymentAccounts]] = await connection.query(
    'SHOW CREATE TABLE booking_payment_accounts'
  )
  const report = {
    columns,
    indexes,
    constraints,
    triggers,
    migration,
    mismatches: mismatches[0],
    foreignKeyError,
    foreignKeys,
    referencedColumns,
    createPaymentAccounts: createPaymentAccounts['Create Table'],
  }
  if (process.argv.includes('--summary')) {
    const columnNames = new Set(columns.map((column) => `${column.TABLE_NAME}.${column.COLUMN_NAME}`))
    const indexNames = new Set(indexes.map((index) => `${index.TABLE_NAME}.${index.INDEX_NAME}`))
    const constraintNames = new Set(
      constraints.map((constraint) => `${constraint.TABLE_NAME}.${constraint.CONSTRAINT_NAME}`)
    )
    const triggerNames = new Set(triggers.map((trigger) => trigger.TRIGGER_NAME))
    const required = {
      columns: [
        'job_funds.quote_id',
        'job_funds.initiated_request_id',
        'job_funds.initiated_session_fingerprint',
        'marketplace_payment_intents.quote_id',
        'marketplace_payment_intents.initiated_request_id',
        'marketplace_payment_intents.initiated_session_fingerprint',
        'booking_payment_accounts.active_booking_id',
      ],
      indexes: [
        'booking_quotes.uq_booking_quote_relational',
        'job_funds.uq_job_fund_payment_link',
        'marketplace_payment_intents.uq_marketplace_payment_provider_tx',
        'marketplace_payment_intents.uq_marketplace_payment_link',
        'booking_payment_accounts.uq_booking_payment_intent',
        'booking_payment_accounts.uq_booking_payment_one_active',
      ],
      constraints: [
        'job_funds.fk_job_fund_quote_link',
        'marketplace_payment_intents.fk_marketplace_payment_job_link',
        'booking_payment_accounts.fk_booking_payment_intent_link',
        'booking_payment_accounts.fk_booking_payment_quote',
      ],
      triggers: ['fill_job_fund_payment_context', 'fill_payment_intent_context'],
    }
    const missing = [
      ...required.columns.filter((name) => !columnNames.has(name)),
      ...required.indexes.filter((name) => !indexNames.has(name)),
      ...required.constraints.filter((name) => !constraintNames.has(name)),
      ...required.triggers.filter((name) => !triggerNames.has(name)),
    ]
    const quoteForeignKey = foreignKeys.find(
      (foreignKey) => foreignKey.CONSTRAINT_NAME === 'fk_booking_payment_quote'
    )
    const mismatchCount = Object.values(mismatches[0] || {})
      .reduce((sum, value) => sum + Number(value || 0), 0)
    const quoteRulesPassed = quoteForeignKey?.DELETE_RULE === 'RESTRICT'
      && quoteForeignKey?.UPDATE_RULE === 'RESTRICT'
    const summary = {
      status: missing.length === 0 && mismatchCount === 0
        && migration.length === 1 && quoteRulesPassed
        ? 'passed'
        : 'failed',
      migration: migration[0] || null,
      missing,
      mismatchCount,
      quoteDeleteRule: quoteForeignKey?.DELETE_RULE || null,
      quoteUpdateRule: quoteForeignKey?.UPDATE_RULE || null,
      requiredObjectCounts: {
        columns: required.columns.length,
        indexes: required.indexes.length,
        constraints: required.constraints.length,
        triggers: required.triggers.length,
      },
    }
    console.log(JSON.stringify(summary, null, 2))
    if (summary.status !== 'passed') process.exitCode = 2
  } else {
    console.log(JSON.stringify(report, null, 2))
  }
} finally {
  await connection.end()
}
