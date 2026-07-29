#!/usr/bin/env node

import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { gunzipSync } from 'zlib'
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

const manifestArgument = process.argv.find((argument) => argument.endsWith('.manifest.json'))
const targetArgument = process.argv.find((argument) => argument.startsWith('--target='))
if (!manifestArgument || !targetArgument) {
  throw new Error(
    'Usage: node scripts/restore-backup.mjs <backup.manifest.json> --target=anywork365_restore_<name>'
  )
}

const manifestPath = resolve(manifestArgument)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const targetDatabase = targetArgument.slice('--target='.length)
if (!/^anywork365_(restore|staging|test)_[a-z0-9_]+$/i.test(targetDatabase)) {
  throw new Error('Restore target must begin with anywork365_restore_, anywork365_staging_, or anywork365_test_')
}
const backupPath = resolve(dirname(manifestPath), manifest.artifact.file)
const compressed = readFileSync(backupPath)
const checksum = createHash('sha256').update(compressed).digest('hex')
if (checksum !== manifest.artifact.sha256) {
  throw new Error('Backup checksum does not match its manifest')
}

const connection = await mysql.createConnection({
  ...databaseOptions(),
  multipleStatements: true,
})
try {
  const [existing] = await connection.query(
    'SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?',
    [targetDatabase]
  )
  if (existing.length) throw new Error(`Restore target already exists: ${targetDatabase}`)

  await connection.query(`CREATE DATABASE ${quoteIdentifier(targetDatabase)}
    CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`)
  await connection.query(`USE ${quoteIdentifier(targetDatabase)}`)
  // Legacy production rows contain zero dates. Preserve them during a restore
  // rehearsal without changing the server's global SQL mode.
  await connection.query("SET SESSION sql_mode='ANSI_QUOTES,NO_ENGINE_SUBSTITUTION'")
  await connection.query(gunzipSync(compressed).toString('utf8'))

  const mismatches = []
  for (const [tableName, expected] of Object.entries(manifest.objects.tableCounts)) {
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`
    )
    if (Number(row.count) !== Number(expected)) {
      mismatches.push({ tableName, expected, actual: Number(row.count) })
    }
  }
  if (mismatches.length) {
    throw new Error(`Restore row-count verification failed: ${JSON.stringify(mismatches)}`)
  }

  console.log(JSON.stringify({
    status: 'verified',
    targetDatabase,
    sha256: checksum,
    tables: Object.keys(manifest.objects.tableCounts).length,
    rows: Object.values(manifest.objects.tableCounts)
      .reduce((sum, count) => sum + Number(count), 0),
  }, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    status: 'failed',
    targetDatabase,
    recovery: `Inspect or remove the isolated database ${targetDatabase} after diagnosing the failure.`,
  }, null, 2))
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
    ssl,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true,
  }
}

function quoteIdentifier(value) {
  return `\`${String(value).replaceAll('`', '``')}\``
}
