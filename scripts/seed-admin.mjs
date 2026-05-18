import mysql from 'mysql2/promise'
import admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '..', '.env') })

async function main() {
  // ── Firebase Admin ──────────────────────────────────────────────────
  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!saRaw) { console.error('FIREBASE_SERVICE_ACCOUNT not set'); process.exit(1) }
  const sa = JSON.parse(saRaw)

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) })
  }
  const auth = admin.auth()

  // ── MySQL ────────────────────────────────────────────────────────────
  const sslConfig = process.env.MYSQL_SSL === 'true' && process.env.MYSQL_CA_PATH
    ? { ca: readFileSync(process.env.MYSQL_CA_PATH) }
    : undefined

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: sslConfig,
  })

  // ── Ensure role column exists ────────────────────────────────────────
  await conn.execute(
    `ALTER TABLE users ADD COLUMN role ENUM('client','vendor','admin') DEFAULT NULL AFTER hasBusinessAccount`
  ).catch(() => {})

  // ── Ensure disputes + audit log tables ────────────────────────────────
  await conn.execute(`CREATE TABLE IF NOT EXISTS disputes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bookingId INT NOT NULL,
    clientUid VARCHAR(128) NOT NULL,
    vendorUid VARCHAR(128) NOT NULL,
    raisedBy VARCHAR(128) NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('open','investigating','resolved','dismissed') DEFAULT 'open',
    resolution TEXT,
    resolvedBy VARCHAR(128),
    resolvedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(() => {})

  await conn.execute(`CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adminUid VARCHAR(128) NOT NULL,
    action VARCHAR(255) NOT NULL,
    targetType VARCHAR(64),
    targetId VARCHAR(128),
    details JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {})

  // ── Create admin accounts ────────────────────────────────────────────
  const admins = [
    { email: 'admin@anywork365.com', password: 'AdminPass123!', name: 'Super Admin' },
    { email: 'moderator@anywork365.com', password: 'ModPass123!', name: 'Moderator' },
  ]

  for (const a of admins) {
    // Check Firebase user
    let uid
    try {
      const existing = await auth.getUserByEmail(a.email)
      uid = existing.uid
      console.log(`Firebase user exists: ${a.email} (${uid})`)
    } catch {
      const rec = await auth.createUser({
        email: a.email,
        password: a.password,
        displayName: a.name,
        emailVerified: true,
      })
      uid = rec.uid
      console.log(`Created Firebase user: ${a.email} (${uid})`)
    }

    // Check/insert into MySQL
    const [existing] = await conn.execute('SELECT userId FROM users WHERE uid = ?', [uid])
    if (existing[0]) {
      await conn.execute(
        "UPDATE users SET role = 'admin', suspended = 0 WHERE uid = ?",
        [uid]
      )
      console.log(`Updated role=admin for ${a.email}`)
    } else {
      await conn.execute(
        `INSERT INTO users (uid, email, fullName, phoneNumber, state, gender, profileImage, address, googleAddress, userLat, userLong, hasBusinessAccount, role, verified, suspended, businessUuid, loginProvider, dateJoined, deleted)
         VALUES (?, ?, ?, '', 'Lagos', '', '', '', '', '0.0', '0.0', 0, 'admin', 1, 0, ?, 'seed', NOW(), 0)`,
        [uid, a.email, a.name, uid.substring(0, 8)]
      )
      console.log(`Created DB user for ${a.email}`)
    }
  }

  await conn.end()
  console.log('\nDone. Admin accounts ready.')
  console.log('  admin@anywork365.com / AdminPass123!')
  console.log('  moderator@anywork365.com / ModPass123!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
