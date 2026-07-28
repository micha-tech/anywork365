import mysql from 'mysql2/promise'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({
  path: [
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '.env.production'),
    resolve(__dirname, '..', '.env'),
  ],
  quiet: true,
})

const apply = process.argv.includes('--apply')

function databaseOptions() {
  const usePooler = process.env.MYSQL_USE_POOLER === 'true'
  let ssl
  if (process.env.MYSQL_SSL === 'skip-verify') ssl = { rejectUnauthorized: false }
  if (process.env.MYSQL_SSL === 'true') {
    ssl = process.env.MYSQL_CA_PATH
      ? { ca: readFileSync(process.env.MYSQL_CA_PATH).toString() }
      : { rejectUnauthorized: true }
  }
  return {
    host: usePooler ? (process.env.MYSQL_POOLER_HOST || process.env.MYSQL_HOST) : process.env.MYSQL_HOST,
    port: Number(usePooler ? (process.env.MYSQL_POOLER_PORT || 33061) : (process.env.MYSQL_PORT || 3306)),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl,
  }
}

async function account(conn, ownerType, ownerId, purpose) {
  await conn.execute(
    `INSERT INTO money_accounts (owner_type, owner_id, purpose, currency)
     VALUES (?, ?, ?, 'NGN')
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [ownerType, ownerId, purpose]
  )
  const [rows] = await conn.execute(
    `SELECT id, balance_kobo FROM money_accounts
     WHERE owner_type = ? AND owner_id = ? AND purpose = ? AND currency = 'NGN'`,
    [ownerType, ownerId, purpose]
  )
  return rows[0]
}

async function post(conn, input) {
  const [existing] = await conn.execute(
    'SELECT id FROM money_transactions WHERE idempotency_key = ?',
    [input.idempotencyKey]
  )
  if (existing[0]) return existing[0].id
  if (input.entries.reduce((sum, entry) => sum + entry.deltaKobo, 0) !== 0) {
    throw new Error(`Unbalanced import transaction: ${input.reference}`)
  }
  const [result] = await conn.execute(
    `INSERT INTO money_transactions (
       reference, idempotency_key, transaction_type, status, amount_kobo, currency,
       user_uid, booking_id, external_reference, metadata
     ) VALUES (?, ?, ?, 'success', ?, 'NGN', ?, ?, ?, ?)`,
    [
      input.reference,
      input.idempotencyKey,
      input.type,
      input.amountKobo,
      input.userUid || null,
      input.bookingId || null,
      input.externalReference || null,
      JSON.stringify({ importedFromLegacy: true }),
    ]
  )
  for (const entry of input.entries) {
    await conn.execute(
      'INSERT INTO money_entries (transaction_id, account_id, delta_kobo) VALUES (?, ?, ?)',
      [result.insertId, entry.accountId, entry.deltaKobo]
    )
    await conn.execute(
      'UPDATE money_accounts SET balance_kobo = balance_kobo + ? WHERE id = ?',
      [entry.deltaKobo, entry.accountId]
    )
  }
  return result.insertId
}

async function main() {
  const conn = await mysql.createConnection(databaseOptions())
  const summary = {
    userWallets: 0,
    userBalanceKobo: 0,
    heldEscrows: 0,
    heldEscrowKobo: 0,
    pendingWithdrawals: 0,
    pendingWithdrawalKobo: 0,
    systemBalanceKobo: 0,
  }

  try {
    const [table] = await conn.query("SHOW TABLES LIKE 'money_accounts'")
    if (!table.length) throw new Error('Run 2026-07-29-money-ledger-v2.sql before importing balances')

    await conn.beginTransaction()
    const clearing = await account(conn, 'platform', 'anywork365', 'legacy_import')
    const fees = await account(conn, 'platform', 'anywork365', 'fees')

    const [wallets] = await conn.query(
      `SELECT w.id AS wallet_id, u.uid,
              COALESCE(SUM(CASE WHEN wl.direction = 'credit' THEN wl.amount ELSE -wl.amount END), 0) AS balance
       FROM wallets w
       JOIN users u ON u.userId = w.user_id
       LEFT JOIN wallet_ledger wl ON wl.wallet_id = w.id
       WHERE w.wallet_type = 'user' AND u.deleted = 0
       GROUP BY w.id, u.uid`
    )
    for (const wallet of wallets) {
      const amountKobo = Math.round(Number(wallet.balance) * 100)
      if (amountKobo < 0) throw new Error(`Legacy wallet ${wallet.wallet_id} has a negative balance`)
      const available = await account(conn, 'user', wallet.uid, 'available')
      await account(conn, 'user', wallet.uid, 'withdrawal_reserved')
      await account(conn, 'user', wallet.uid, 'chargeback_reserve')
      if (amountKobo > 0) {
        await post(conn, {
          reference: `legacy_wallet_${wallet.wallet_id}`,
          idempotencyKey: `legacy:wallet:${wallet.wallet_id}`,
          type: 'legacy_balance_import',
          amountKobo,
          userUid: wallet.uid,
          externalReference: String(wallet.wallet_id),
          entries: [
            { accountId: available.id, deltaKobo: amountKobo },
            { accountId: clearing.id, deltaKobo: -amountKobo },
          ],
        })
      }
      summary.userWallets++
      summary.userBalanceKobo += amountKobo
    }

    const [systemRows] = await conn.query(
      `SELECT w.wallet_type,
              COALESCE(SUM(CASE WHEN wl.direction = 'credit' THEN wl.amount ELSE -wl.amount END), 0) AS balance
       FROM wallets w
       LEFT JOIN wallet_ledger wl ON wl.wallet_id = w.id
       WHERE w.wallet_type <> 'user'
       GROUP BY w.wallet_type`
    )
    for (const row of systemRows) {
      const amountKobo = Math.round(Number(row.balance) * 100)
      if (amountKobo <= 0) continue
      await post(conn, {
        reference: `legacy_system_${row.wallet_type}`,
        idempotencyKey: `legacy:system:${row.wallet_type}`,
        type: 'legacy_platform_import',
        amountKobo,
        entries: [
          { accountId: fees.id, deltaKobo: amountKobo },
          { accountId: clearing.id, deltaKobo: -amountKobo },
        ],
      })
      summary.systemBalanceKobo += amountKobo
    }

    const [escrows] = await conn.query(
      `SELECT we.*, cu.uid AS client_uid, vu.uid AS artisan_uid
       FROM wallet_escrow we
       JOIN wallets cw ON cw.id = we.client_wallet_id
       JOIN users cu ON cu.userId = cw.user_id
       JOIN wallets vw ON vw.id = we.vendor_wallet_id
       JOIN users vu ON vu.userId = vw.user_id
       WHERE we.status = 'held'`
    )
    for (const escrow of escrows) {
      const [existing] = await conn.execute(
        'SELECT id FROM booking_escrows_v2 WHERE booking_id = ?',
        [escrow.booking_id]
      )
      if (existing[0]) continue
      const amountKobo = Math.round(Number(escrow.amount) * 100)
      const escrowAccount = await account(conn, 'booking', String(escrow.booking_id), 'escrow')
      const transactionId = await post(conn, {
        reference: `legacy_hold_${escrow.booking_id}`,
        idempotencyKey: `legacy:escrow:${escrow.booking_id}`,
        type: 'legacy_escrow_import',
        amountKobo,
        userUid: escrow.client_uid,
        bookingId: escrow.booking_id,
        entries: [
          { accountId: escrowAccount.id, deltaKobo: amountKobo },
          { accountId: clearing.id, deltaKobo: -amountKobo },
        ],
      })
      await conn.execute(
        `INSERT INTO booking_escrows_v2 (
           reference, booking_id, client_uid, artisan_uid, escrow_account_id,
           amount_kobo, platform_fee_kobo, status, hold_transaction_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 0, 'held', ?, ?)`,
        [
          `legacy_hold_${escrow.booking_id}`,
          escrow.booking_id,
          escrow.client_uid,
          escrow.artisan_uid,
          escrowAccount.id,
          amountKobo,
          transactionId,
          escrow.created_at,
        ]
      )
      summary.heldEscrows++
      summary.heldEscrowKobo += amountKobo
    }

    const [withdrawals] = await conn.query(
      `SELECT wr.*, u.uid, wa.bank_name, wa.bank_code, wa.account_number,
              wa.account_name, wa.recipient_code
       FROM withdrawals wr
       JOIN users u ON u.userId = wr.user_id
       LEFT JOIN withdrawal_accounts wa ON wa.id = wr.account_id
       WHERE wr.status IN ('pending', 'processing')`
    )
    for (const withdrawal of withdrawals) {
      const reference = `WD_${withdrawal.id}`
      const [existing] = await conn.execute(
        'SELECT id FROM withdrawal_requests_v2 WHERE reference = ?',
        [reference]
      )
      if (existing[0]) continue
      if (!withdrawal.recipient_code) {
        throw new Error(`Pending withdrawal ${withdrawal.id} has no Paystack recipient code`)
      }
      const amountKobo = Math.round(Number(withdrawal.amount) * 100)
      const reserved = await account(conn, 'user', withdrawal.uid, 'withdrawal_reserved')
      const transactionId = await post(conn, {
        reference: `legacy_reserve_${withdrawal.id}`,
        idempotencyKey: `legacy:withdrawal:${withdrawal.id}`,
        type: 'legacy_withdrawal_import',
        amountKobo,
        userUid: withdrawal.uid,
        externalReference: reference,
        entries: [
          { accountId: reserved.id, deltaKobo: amountKobo },
          { accountId: clearing.id, deltaKobo: -amountKobo },
        ],
      })
      await conn.execute(
        `INSERT INTO withdrawal_requests_v2 (
           reference, user_uid, amount_kobo, currency, status, reserved_account_id,
           bank_name, bank_code, account_last4, account_name, recipient_code,
           reserve_transaction_id, failure_reason, created_at
         ) VALUES (?, ?, ?, 'NGN', 'manual_review', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reference,
          withdrawal.uid,
          amountKobo,
          reserved.id,
          withdrawal.bank_name || 'Unknown bank',
          withdrawal.bank_code || '',
          String(withdrawal.account_number || '').slice(-4).padStart(4, '0'),
          withdrawal.account_name || 'Unknown account',
          withdrawal.recipient_code,
          transactionId,
          'Imported pending withdrawal; verify against Paystack before action',
          withdrawal.created_at,
        ]
      )
      summary.pendingWithdrawals++
      summary.pendingWithdrawalKobo += amountKobo
    }

    if (apply) await conn.commit()
    else await conn.rollback()
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', summary }, null, 2))
    if (!apply) console.log('Dry run only. Re-run with --apply after reviewing this summary and a database backup.')
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    await conn.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
