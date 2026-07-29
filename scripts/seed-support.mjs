import mysql from 'mysql2/promise'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'fs'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: [resolve(__dirname, '..', '.env.local'), resolve(__dirname, '..', '.env')] })

const email = process.env.SUPPORT_EMAIL?.trim().toLowerCase()
const password = process.env.SUPPORT_PASSWORD

if (!email || !password) {
  console.error('SUPPORT_EMAIL and SUPPORT_PASSWORD are required')
  process.exit(1)
}

async function main() {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured')

  const app = getApps()[0] ?? initializeApp({
    credential: cert(JSON.parse(serviceAccount)),
  })
  const auth = getAuth(app)

  let firebaseUser
  try {
    firebaseUser = await auth.getUserByEmail(email)
    firebaseUser = await auth.updateUser(firebaseUser.uid, {
      password,
      emailVerified: true,
      disabled: false,
      displayName: 'Customer Support',
    })
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error
    firebaseUser = await auth.createUser({
      email,
      password,
      emailVerified: true,
      disabled: false,
      displayName: 'Customer Support',
    })
  }

  const sslMode = process.env.MYSQL_SSL || ''
  let ssl
  if (sslMode === 'skip-verify') {
    ssl = { rejectUnauthorized: false }
  } else if (sslMode === 'true') {
    ssl = process.env.MYSQL_CA_PATH
      ? { ca: readFileSync(process.env.MYSQL_CA_PATH).toString() }
      : { rejectUnauthorized: true }
  }

  const usePooler = process.env.MYSQL_USE_POOLER === 'true'
  const connection = await mysql.createConnection({
    host: usePooler ? (process.env.MYSQL_POOLER_HOST || process.env.MYSQL_HOST) : process.env.MYSQL_HOST,
    port: Number(usePooler ? (process.env.MYSQL_POOLER_PORT || 33061) : (process.env.MYSQL_PORT || 3306)),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl,
  })

  try {
    await connection.execute(
      "ALTER TABLE users MODIFY COLUMN role ENUM('client','artisan','professional','recruiter','support','admin') DEFAULT NULL"
    )

    const [rows] = await connection.execute(
      'SELECT userId FROM users WHERE uid = ? OR LOWER(email) = LOWER(?) LIMIT 1',
      [firebaseUser.uid, email]
    )

    if (rows[0]) {
      await connection.execute(
        `UPDATE users
         SET uid = ?, email = ?, fullName = 'Customer Support', role = 'support',
             verified = 1, suspended = 0, deleted = 0
         WHERE userId = ?`,
        [firebaseUser.uid, email, rows[0].userId]
      )
    } else {
      await connection.execute(
        `INSERT INTO users (
           uid, email, fullName, phoneNumber, state, gender, profileImage, address,
           googleAddress, hasBusinessAccount, role, verified, suspended, businessUuid,
           loginProvider, dateJoined, deleted
         ) VALUES (?, ?, 'Customer Support', '', 'Lagos', '', '', '', '', 0, 'support', 1, 0, ?, 'seed', NOW(), 0)`,
        [firebaseUser.uid, email, firebaseUser.uid.slice(0, 8)]
      )
    }
  } finally {
    await connection.end()
  }

  console.log(`Customer support account is ready: ${email}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
