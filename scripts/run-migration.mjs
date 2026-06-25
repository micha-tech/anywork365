#!/usr/bin/env node
/**
 * Usage: node scripts/run-migration.mjs [file.sql]
 * If no file is specified, runs all unapplied migration-*.sql scripts in order.
 *
 * Example: node scripts/run-migration.mjs scripts/migration-20260526-idempotency.sql
 */
import mysql from 'mysql2/promise'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

const sslMode = process.env.MYSQL_SSL || ''
let sslConfig = {}
if (sslMode === 'skip-verify') {
  sslConfig = { ssl: { rejectUnauthorized: false } }
} else if (sslMode === 'true') {
  const caPath = process.env.MYSQL_CA_PATH
  if (caPath && existsSync(caPath)) {
    sslConfig = { ssl: { ca: readFileSync(caPath, 'utf8') } }
  } else {
    sslConfig = { ssl: { rejectUnauthorized: true } }
  }
}

async function main() {
  const target = process.argv[2]

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ...sslConfig,
    multipleStatements: true,
  })

  console.log('Connected:', process.env.MYSQL_HOST)

  // Track which migrations have been applied
  await conn.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  const files = target
    ? [target]
    : readdirSync(resolve(__dirname))
        .filter(f => f.startsWith('migration-') && f.endsWith('.sql'))
        .sort()

  for (const file of files) {
    const filePath = resolve(process.cwd(), file)
    if (!existsSync(filePath)) {
      console.error(`  [SKIP] File not found: ${file}`)
      continue
    }

    const [rows] = await conn.execute('SELECT 1 FROM _migrations WHERE filename = ?', [file])
    if (rows.length > 0) {
      console.log(`  [SKIP] Already applied: ${file}`)
      continue
    }

    const sql = readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const stmt of statements) {
      try {
        await conn.execute(stmt + ';')
      } catch (err) {
        const msg = /** @type {{ message?: string }} */ (err)?.message || ''
        console.warn(`  [WARN] ${msg.substring(0, 120)}`)
      }
    }

    await conn.execute('INSERT INTO _migrations (filename) VALUES (?)', [file])
    console.log(`  [OK] Applied: ${file}`)
  }

  await conn.end()
  console.log('Done.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
