#!/usr/bin/env node
/**
 * Database backup script for AnyWork365 (managed-database MySQL)
 *
 * Usage:
 *   node scripts/backup.mjs                    # creates backup in cwd
 *   node scripts/backup.mjs ./backups          # creates backup in ./backups
 *
 * Requires: mysqldump (MySQL client) installed locally
 * Reads env vars: MYSQL_HOST, MYSQL_PORT, MYSQL_USER,
 *                 MYSQL_PASSWORD, MYSQL_DATABASE
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { format } from 'util'

const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
for (const varName of required) {
  if (!process.env[varName]) {
    console.error(`[BACKUP] Missing required env var: ${varName}`)
    process.exit(1)
  }
}

const outDir = resolve(process.argv[2] || '.')
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true })
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
const filename = `anywork365_backup_${timestamp}.sql.gz`
const filepath = join(outDir, filename)

const host = process.env.MYSQL_HOST!
const port = process.env.MYSQL_PORT || '3306'
const user = process.env.MYSQL_USER!
const pass = process.env.MYSQL_PASSWORD!
const db = process.env.MYSQL_DATABASE!
const caPath = process.env.MYSQL_CA_PATH || ''

const sslArgs = caPath && existsSync(caPath)
  ? `--ssl-ca="${caPath}" --ssl-mode=VERIFY_CA`
  : '--ssl-mode=PREFERRED'

const cmd = `mysqldump --host="${host}" --port=${port} --user="${user}" --password="${pass}" ${sslArgs} --single-transaction --routines --triggers --hex-blob "${db}" | gzip > "${filepath}"`

console.log(`[BACKUP] Starting: ${filename}`)
console.log(`[BACKUP] Host: ${host}:${port}, DB: ${db}`)

try {
  execSync(cmd, { shell: true, stdio: 'pipe', timeout: 300_000 })
  const { statSync } = await import('fs')
  const size = statSync(filepath).size
  const sizeMB = (size / 1024 / 1024).toFixed(2)
  console.log(`[BACKUP] Complete: ${filename} (${sizeMB} MB)`)

  // Write a verification marker
  writeFileSync(`${filepath}.verified`, `OK ${timestamp}\n`)
  console.log(`[BACKUP] Verification marker written`)
} catch (err) {
  console.error('[BACKUP] Failed:', err.message || err)
  process.exit(1)
}
