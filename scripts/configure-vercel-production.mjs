#!/usr/bin/env node

import { spawnSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
config({
  path: [
    resolve(scriptDirectory, '..', '.env.local'),
    resolve(scriptDirectory, '..', '.env'),
  ],
  quiet: true,
})

const sensitive = new Set([
  'FIREBASE_SERVICE_ACCOUNT',
  'JWT_SECRET',
  'CHAT_ENCRYPTION_KEY',
  'MYSQL_PASSWORD',
  'PAYSTACK_SECRET_KEY',
  'MYSQL_CA_BASE64',
])
process.env.MYSQL_CA_BASE64 = Buffer.from(
  readFileSync(resolve(scriptDirectory, '..', 'certs', 'ca.pem'))
).toString('base64')
const variables = [
  'FIREBASE_SERVICE_ACCOUNT',
  'JWT_SECRET',
  'CHAT_ENCRYPTION_KEY',
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
  'MYSQL_SSL',
  'MYSQL_CA_BASE64',
  'NEXT_PUBLIC_APP_NAME',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
  'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'PAYSTACK_SECRET_KEY',
  'NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY',
]
const vercelCli =
  process.platform === 'win32'
    ? join(process.env.APPDATA || '', 'npm', 'node_modules', 'vercel', 'dist', 'vc.js')
    : null

for (const name of variables) {
  const value = process.env[name]
  if (!value) throw new Error(`Required production value is missing locally: ${name}`)
  const result = spawnSync(
    vercelCli ? process.execPath : 'vercel',
    [
      ...(vercelCli ? [vercelCli] : []),
      'env',
      'add',
      name,
      'production',
      '--value',
      value,
      '--force',
      sensitive.has(name) ? '--sensitive' : '--no-sensitive',
      '--yes',
    ],
    {
      cwd: resolve(scriptDirectory, '..'),
      encoding: 'utf8',
      windowsHide: true,
    }
  )
  if (result.status !== 0) {
    throw new Error(
      `Vercel rejected ${name}: ${(result.stderr || result.stdout || '').trim()}`
        + (result.error ? ` (${result.error.message})` : '')
    )
  }
  console.log(`Configured ${name}${sensitive.has(name) ? ' (sensitive)' : ''}`)
}

console.log(`Configured ${variables.length} production variables without printing their values.`)
