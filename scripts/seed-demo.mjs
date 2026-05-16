/**
 * Creates demo accounts for Google Play review.
 * Run: node scripts/seed-demo.mjs
 *
 * Requires: .env with Firebase Admin + MySQL credentials
 */
import { config } from 'dotenv'
import fs from 'fs'
import { createRequire } from 'module'
import { randomBytes } from 'crypto'

config({ path: '.env' })

const require = createRequire(import.meta.url)
const mysql = require('mysql2/promise')
const admin = require('firebase-admin')

const DEMO_CLIENT = { email: 'demo.client@anywork365.com', password: 'DemoTest123!' }
const DEMO_VENDOR = { email: 'demo.vendor@anywork365.com', password: 'DemoTest123!' }

async function main() {
  // ── Firebase Admin ──────────────────────────────────────────────
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set')
  const sa = JSON.parse(raw)
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(sa) })
  }
  const auth = admin.auth()

  // ── MySQL ────────────────────────────────────────────────────────
  const sslMode = process.env.MYSQL_SSL || ''
  let sslConfig = {}
  if (sslMode === 'skip-verify') {
    sslConfig = { ssl: { rejectUnauthorized: false } }
  } else if (sslMode === 'true') {
    const caPath = process.env.MYSQL_CA_PATH
    if (caPath && fs.existsSync(caPath)) {
      sslConfig = { ssl: { ca: fs.readFileSync(caPath, 'utf8') } }
    } else {
      sslConfig = { ssl: { rejectUnauthorized: true } }
    }
  }
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ...sslConfig,
  })

  async function createDemoUser(email, password, fullName, role) {
    // Create Firebase Auth user
    let uid
    try {
      const fb = await auth.createUser({ email, password, displayName: fullName, emailVerified: true })
      uid = fb.uid
      console.log(`  ✓ Firebase user created: ${email} (${uid})`)
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        const fb = await auth.getUserByEmail(email)
        uid = fb.uid
        await auth.updateUser(uid, { emailVerified: true })
        console.log(`  ~ Firebase user already exists: ${email} (${uid})`)
      } else {
        throw e
      }
    }

    // Insert into MySQL users table
    const [existing] = await pool.execute('SELECT userId FROM users WHERE uid = ?', [uid])
    if (existing.length === 0) {
      await pool.execute(
        `INSERT INTO users (uid, email, fullName, phoneNumber, state, loginProvider, dateJoined)
         VALUES (?, ?, ?, ?, ?, 'EmailAndPassword', NOW())`,
        [uid, email, fullName, '0800000000', 'Lagos']
      )
      console.log(`  ✓ MySQL user created: ${fullName}`)
    } else {
      console.log(`  ~ MySQL user already exists: ${fullName}`)
    }

    // Get userId
    const [rows] = await pool.execute('SELECT userId FROM users WHERE uid = ?', [uid])
    const userId = rows[0].userId

    // Create wallet if not exists
    const [wrows] = await pool.execute('SELECT id FROM wallets WHERE user_id = ?', [userId])
    let walletId
    if (wrows.length === 0) {
      const w = await pool.execute('INSERT INTO wallets (user_id, email) VALUES (?, ?)', [userId, email])
      walletId = w[0].insertId
      console.log(`  ✓ Wallet created: id=${walletId}`)
    } else {
      walletId = wrows[0].id
      console.log(`  ~ Wallet already exists: id=${walletId}`)
    }

    return { uid, userId, walletId }
  }

  console.log('\n=== Creating demo client ===')
  const client = await createDemoUser(DEMO_CLIENT.email, DEMO_CLIENT.password, 'Demo Client', 'client')

  // Fund client wallet with ₦500,000
  const [cbal] = await pool.execute('SELECT balance_after FROM wallet_ledger WHERE wallet_id = ? ORDER BY id DESC LIMIT 1', [client.walletId])
  const clientCurrentBal = cbal.length > 0 ? cbal[0].balance_after : 0
  if (clientCurrentBal < 500000) {
    const fundAmount = 500000 - clientCurrentBal
    const ref = `DEMO_${randomBytes(8).toString('hex')}`
    await pool.execute(
      'INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, transaction_id, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
      [client.walletId, fundAmount, 'credit', clientCurrentBal + fundAmount, 'Demo account funding for Play Store review']
    )
    await pool.execute(
      'INSERT INTO wallet_transactions (reference, type, status, metadata, created_at) VALUES (?, ?, ?, ?, NOW())',
      [ref, 'deposit', 'success', JSON.stringify({ source: 'demo_seed' })]
    )
    console.log(`  ✓ Client wallet funded`)
  } else {
    console.log(`  ~ Client wallet already has ₦${clientCurrentBal.toLocaleString()}`)
  }

  console.log('\n=== Creating demo vendor ===')
  const vendor = await createDemoUser(DEMO_VENDOR.email, DEMO_VENDOR.password, 'Demo Vendor', 'vendor')

  // Create business
  const [bizRows] = await pool.execute("SELECT businessId FROM businesses WHERE uid = ? AND deleted = 0", [vendor.uid])
  let businessId
  if (bizRows.length === 0) {
    const b = await pool.execute(
      `INSERT INTO businesses (uid, businessName, category, businessContact, state, location, dateStarted, deleted, rating, reviews)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), 0, 5.0, 0)`,
      [vendor.uid, 'Demo Repairs Ltd', 'Repair services', '0800000000', 'Lagos', '42 Ikorodu Road, Lagos']
    )
    businessId = b[0].insertId
    await pool.execute('UPDATE users SET hasBusinessAccount = 1 WHERE uid = ?', [vendor.uid])
    console.log(`  ✓ Business created: Demo Repairs Ltd (id=${businessId})`)
  } else {
    businessId = bizRows[0].businessId
    console.log(`  ~ Business already exists: id=${businessId}`)
  }

  // Fund vendor wallet with ₦100,000
  const [vbal] = await pool.execute('SELECT balance_after FROM wallet_ledger WHERE wallet_id = ? ORDER BY id DESC LIMIT 1', [vendor.walletId])
  const vendorCurrentBal = vbal.length > 0 ? vbal[0].balance_after : 0
  if (vendorCurrentBal < 100000) {
    const fundAmount = 100000 - vendorCurrentBal
    const ref = `DEMO_${randomBytes(8).toString('hex')}`
    await pool.execute(
      'INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, transaction_id, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
      [vendor.walletId, fundAmount, 'credit', vendorCurrentBal + fundAmount, 'Demo account funding for Play Store review']
    )
    await pool.execute(
      'INSERT INTO wallet_transactions (reference, type, status, metadata, created_at) VALUES (?, ?, ?, ?, NOW())',
      [ref, 'deposit', 'success', JSON.stringify({ source: 'demo_seed' })]
    )
    console.log(`  ✓ Vendor wallet funded ₦${(vendorCurrentBal + fundAmount).toLocaleString()}`)
  }

  // Add a sample job listing
  const [jobRows] = await pool.execute('SELECT vacancy_id FROM vacancies WHERE company_id = ? LIMIT 1', [businessId])
  if (jobRows.length === 0) {
    await pool.execute(
      `INSERT INTO vacancies (company_id, vacancy_title, vacancy_location, job_description, work_type, job_type, required_skills, date_created)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [businessId, 'Phone Technician Needed', 'Lagos', 'Looking for an experienced phone repair technician. Must have at least 3 years experience with iPhone and Android repairs.', 'Onsite', 'Full-time', 'Phone repair, soldering, component-level troubleshooting']
    )
    console.log('  ✓ Sample job listing created')
  }

  await pool.end()

  console.log('\n✅ Demo accounts ready for Play Store review!')
  console.log('')
  console.log('  Client:')
  console.log(`    Email:    ${DEMO_CLIENT.email}`)
  console.log(`    Password: ${DEMO_CLIENT.password}`)
  console.log(`    Wallet:   ₦500,000`)
  console.log('')
  console.log('  Vendor:')
  console.log(`    Email:    ${DEMO_VENDOR.email}`)
  console.log(`    Password: ${DEMO_VENDOR.password}`)
  console.log(`    Wallet:   ₦100,000`)
  console.log(`    Business: Demo Repairs Ltd`)
  console.log('')
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
