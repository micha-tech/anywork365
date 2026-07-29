#!/usr/bin/env node
/**
 * Portable logical backup for Anywork365 MySQL.
 *
 * Produces:
 *   - a gzip-compressed, restorable SQL dump;
 *   - a manifest with SHA-256, source identity and per-table row counts.
 *
 * This implementation uses mysql2 so it works on hosts without mysqldump/gzip.
 */

import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'
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

const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
for (const variableName of required) {
  if (!process.env[variableName]) {
    throw new Error(`Missing required environment variable: ${variableName}`)
  }
}

const outputDirectory = resolve(process.argv[2] || './backups')
mkdirSync(outputDirectory, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const baseName = `anywork365-backup-${timestamp}`
const sqlGzipPath = join(outputDirectory, `${baseName}.sql.gz`)
const manifestPath = join(outputDirectory, `${baseName}.manifest.json`)

const connection = await mysql.createConnection(databaseOptions())
try {
  await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ')
  await connection.beginTransaction()

  const [[identity]] = await connection.query(
    'SELECT DATABASE() AS databaseName, VERSION() AS serverVersion, UTC_TIMESTAMP() AS capturedAt'
  )
  const [objects] = await connection.query(
    `SELECT table_name, table_type
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
     ORDER BY table_type, table_name`
  )
  const baseTables = objects
    .filter((row) => row.TABLE_TYPE === 'BASE TABLE')
    .map((row) => row.TABLE_NAME)
  const views = objects
    .filter((row) => row.TABLE_TYPE === 'VIEW')
    .map((row) => row.TABLE_NAME)

  const chunks = [
    '-- Anywork365 portable MySQL logical backup',
    `-- Captured at ${new Date(identity.capturedAt).toISOString()}`,
    'SET NAMES utf8mb4;',
    'SET SESSION sql_require_primary_key=0;',
    'SET FOREIGN_KEY_CHECKS=0;',
    'SET UNIQUE_CHECKS=0;',
    '',
  ]
  const tableCounts = {}

  for (const tableName of baseTables) {
    const escapedName = quoteIdentifier(tableName)
    const [[createRow]] = await connection.query(`SHOW CREATE TABLE ${escapedName}`)
    const createSql = createRow['Create Table']
    const [rows] = await connection.query(`SELECT * FROM ${escapedName}`)
    tableCounts[tableName] = rows.length
    chunks.push(`DROP TABLE IF EXISTS ${escapedName};`, `${createSql};`)
    for (let offset = 0; offset < rows.length; offset += 250) {
      const batch = rows.slice(offset, offset + 250)
      const columns = Object.keys(batch[0] || {})
      if (!columns.length) continue
      const values = batch
        .map((row) => `(${columns.map((column) => escapeValue(row[column])).join(',')})`)
        .join(',\n')
      chunks.push(
        `INSERT INTO ${escapedName} (${columns.map(quoteIdentifier).join(',')}) VALUES\n${values};`
      )
    }
    chunks.push('')
  }

  for (const viewName of views) {
    const escapedName = quoteIdentifier(viewName)
    const [[createRow]] = await connection.query(`SHOW CREATE VIEW ${escapedName}`)
    const createSql = createRow['Create View'].replace(/\sDEFINER=`[^`]+`@`[^`]+`/i, '')
    chunks.push(`DROP VIEW IF EXISTS ${escapedName};`, `${createSql};`, '')
  }

  chunks.push('SET UNIQUE_CHECKS=1;', 'SET FOREIGN_KEY_CHECKS=1;', '')
  const sql = chunks.join('\n')
  const compressed = gzipSync(Buffer.from(sql, 'utf8'), { level: 9 })
  writeFileSync(sqlGzipPath, compressed, { flag: 'wx' })

  const manifest = {
    format: 'anywork365-portable-mysql-v1',
    source: {
      host: process.env.MYSQL_HOST,
      database: identity.databaseName,
      serverVersion: identity.serverVersion,
      capturedAt: new Date(identity.capturedAt).toISOString(),
    },
    artifact: {
      file: `${baseName}.sql.gz`,
      bytes: compressed.length,
      uncompressedBytes: Buffer.byteLength(sql),
      sha256: createHash('sha256').update(compressed).digest('hex'),
    },
    objects: {
      baseTables,
      views,
      tableCounts,
    },
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  await connection.commit()

  console.log(JSON.stringify({
    status: 'complete',
    backup: sqlGzipPath,
    manifest: manifestPath,
    tables: baseTables.length,
    views: views.length,
    rows: Object.values(tableCounts).reduce((sum, count) => sum + count, 0),
    sha256: manifest.artifact.sha256,
    bytes: statSync(sqlGzipPath).size,
  }, null, 2))
} catch (error) {
  await connection.rollback().catch(() => undefined)
  throw error
} finally {
  await connection.end()
}

function databaseOptions() {
  let ssl
  if (process.env.MYSQL_SSL === 'skip-verify') ssl = { rejectUnauthorized: false }
  if (process.env.MYSQL_SSL === 'true') {
    ssl = process.env.MYSQL_CA_PATH && existsSync(process.env.MYSQL_CA_PATH)
      ? { ca: readFileSync(process.env.MYSQL_CA_PATH, 'utf8') }
      : { rejectUnauthorized: true }
  }
  return {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true,
  }
}

function quoteIdentifier(value) {
  return `\`${String(value).replaceAll('`', '``')}\``
}

function escapeValue(value) {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Buffer.isBuffer(value) &&
    !(value instanceof Date)
  ) {
    return mysql.escape(JSON.stringify(value))
  }
  return mysql.escape(value)
}
