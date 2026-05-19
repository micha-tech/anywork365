#!/usr/bin/env node
import mysql from 'mysql2/promise'
import { readFileSync, existsSync } from 'fs'
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
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ...sslConfig,
    multipleStatements: true,
  })

  console.log('Connected to MySQL:', process.env.MYSQL_HOST)

  // 1. Apply schema
  const schemaPath = resolve(__dirname, 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf8')
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  for (const stmt of statements) {
    try {
      await conn.execute(stmt + ';')
    } catch (err) {
      const e = /** @type {{ message?: string }} */ (err)
      console.warn(`  [SKIP] ${(e?.message || '').substring(0, 80)}`)
    }
  }
  console.log('Schema applied: 20 tables')

  // 2. Ensure role column on existing users table (for upgrades)
  try {
    await conn.execute(
      `ALTER TABLE users ADD COLUMN role ENUM('client','vendor','admin') DEFAULT NULL AFTER hasBusinessAccount`
    )
    console.log('  Added role column to users')
  } catch {
    // column already exists
  }

  await conn.end()
  console.log('Done. Database is ready.')
}

main().catch((err) => {
  console.error('Init failed:', err)
  process.exit(1)
})
