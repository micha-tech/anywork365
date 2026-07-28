import { createHash, randomUUID } from 'crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getConnection, query, queryOne } from '@/lib/db'
import { getUserRowByUid, getWithdrawalAccounts } from '@/lib/queries'

const CURRENCY = 'NGN'
const PLATFORM_OWNER_ID = 'anywork365'
const PAYSTACK_OWNER_ID = 'paystack'
const PLATFORM_FEE_BPS = 500
const DAILY_FUNDING_LIMIT_KOBO = Number(process.env.WALLET_DAILY_FUNDING_LIMIT_NGN || 2_000_000) * 100
const DAILY_WITHDRAWAL_LIMIT_KOBO = Number(process.env.WALLET_DAILY_WITHDRAWAL_LIMIT_NGN || 1_000_000) * 100

type AccountPurpose =
  | 'available'
  | 'escrow'
  | 'withdrawal_reserved'
  | 'fees'
  | 'paystack_clearing'
  | 'legacy_import'
  | 'chargeback_reserve'

type MoneyAccountRow = RowDataPacket & {
  id: number
  owner_type: string
  owner_id: string
  purpose: AccountPurpose
  currency: string
  balance_kobo: number | string
  status: string
  created_at: string
  updated_at: string
}

type MoneyTransactionRow = RowDataPacket & {
  id: number
  reference: string
  idempotency_key: string | null
  transaction_type: string
  status: string
  amount_kobo: number | string
  user_uid: string | null
  booking_id: number | null
  metadata: string | Record<string, unknown> | null
  created_at: string
}

type FundingIntentRow = RowDataPacket & {
  id: number
  reference: string
  user_uid: string
  customer_email: string
  amount_kobo: number | string
  currency: string
  status: string
}

type BookingEscrowRow = RowDataPacket & {
  id: number
  reference: string
  booking_id: number
  client_uid: string
  artisan_uid: string
  escrow_account_id: number
  amount_kobo: number | string
  platform_fee_kobo: number | string
  status: string
  hold_transaction_id: number
  terminal_transaction_id: number | null
}

type WithdrawalV2Row = RowDataPacket & {
  id: number
  reference: string
  user_uid: string
  amount_kobo: number | string
  currency: string
  status: string
  reserved_account_id: number
  bank_name: string
  bank_code: string
  account_last4: string
  account_name: string
  recipient_code: string
  transfer_code: string | null
  reserve_transaction_id: number
  terminal_transaction_id: number | null
}

export type FundingSettlement = {
  reference: string
  amountKobo: number
  currency: string
  domain: string
  customerEmail: string
  userIdFromMetadata?: string
  transactionId?: string | number
  channel?: string
  paidAt?: string
}

export type WithdrawalBankSnapshot = {
  bankName: string
  bankCode: string
  accountNumber: string
  accountName: string
  recipientCode: string
}

export function isMoneyV2Enabled(): boolean {
  return process.env.MONEY_V2_ENABLED === 'true'
}

export function nairaToKobo(amountNGN: number): number {
  const kobo = Math.round(amountNGN * 100)
  if (!Number.isSafeInteger(kobo) || kobo <= 0) throw new Error('Invalid monetary amount')
  return kobo
}

export function koboToNaira(amountKobo: number | string): number {
  return Number(amountKobo) / 100
}

export function createMoneyReference(prefix: string): string {
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9.-]/g, '-')
  return `${safePrefix}-${randomUUID()}`.slice(0, 50)
}

export async function checkDurableMoneyRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `INSERT IGNORE INTO money_rate_limits (rate_key, request_count, window_started_at)
       VALUES (?, 0, NOW(3))`,
      [key.slice(0, 190)]
    )
    const [rows] = await conn.execute<(RowDataPacket & {
      request_count: number
      window_started_at: Date
    })[]>(
      'SELECT request_count, window_started_at FROM money_rate_limits WHERE rate_key = ? FOR UPDATE',
      [key.slice(0, 190)]
    )
    const row = rows[0]
    const now = Date.now()
    const startedAt = new Date(row.window_started_at).getTime()
    const expired = now - startedAt >= windowMs
    const nextCount = expired ? 1 : Number(row.request_count) + 1
    const nextWindow = expired ? new Date(now) : row.window_started_at

    await conn.execute(
      `UPDATE money_rate_limits
       SET request_count = ?, window_started_at = ?
       WHERE rate_key = ?`,
      [nextCount, nextWindow, key.slice(0, 190)]
    )
    await conn.commit()

    if (nextCount > maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((startedAt + windowMs - now) / 1000)),
      }
    }
    return { allowed: true }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

async function getOrCreateAccount(
  conn: PoolConnection,
  ownerType: string,
  ownerId: string,
  purpose: AccountPurpose
): Promise<MoneyAccountRow> {
  await conn.execute<ResultSetHeader>(
    `INSERT INTO money_accounts (owner_type, owner_id, purpose, currency)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [ownerType, ownerId, purpose, CURRENCY]
  )

  const [rows] = await conn.execute<MoneyAccountRow[]>(
    `SELECT * FROM money_accounts
     WHERE owner_type = ? AND owner_id = ? AND purpose = ? AND currency = ?
     LIMIT 1`,
    [ownerType, ownerId, purpose, CURRENCY]
  )
  if (!rows[0]) throw new Error('Money account could not be created')
  return rows[0]
}

async function userAccount(
  conn: PoolConnection,
  uid: string,
  purpose: 'available' | 'withdrawal_reserved' | 'chargeback_reserve'
) {
  return getOrCreateAccount(conn, 'user', uid, purpose)
}

async function platformAccount(
  conn: PoolConnection,
  purpose: 'fees' | 'legacy_import'
) {
  return getOrCreateAccount(conn, 'platform', PLATFORM_OWNER_ID, purpose)
}

async function paystackClearingAccount(conn: PoolConnection) {
  return getOrCreateAccount(conn, 'paystack', PAYSTACK_OWNER_ID, 'paystack_clearing')
}

async function escrowAccount(conn: PoolConnection, bookingId: number) {
  return getOrCreateAccount(conn, 'booking', String(bookingId), 'escrow')
}

async function postBalancedTransaction(
  conn: PoolConnection,
  input: {
    reference: string
    idempotencyKey: string
    type: string
    amountKobo: number
    userUid?: string
    bookingId?: number
    externalReference?: string
    metadata?: Record<string, unknown>
    entries: Array<{ accountId: number; deltaKobo: number }>
  }
): Promise<{ transaction: MoneyTransactionRow; created: boolean }> {
  if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo <= 0) {
    throw new Error('Transaction amount must be a positive integer in kobo')
  }

  const consolidated = new Map<number, number>()
  for (const entry of input.entries) {
    if (!Number.isSafeInteger(entry.deltaKobo) || entry.deltaKobo === 0) {
      throw new Error('Ledger entries must be non-zero integer kobo values')
    }
    consolidated.set(entry.accountId, (consolidated.get(entry.accountId) || 0) + entry.deltaKobo)
  }
  const entries = [...consolidated.entries()]
    .map(([accountId, deltaKobo]) => ({ accountId, deltaKobo }))
    .filter((entry) => entry.deltaKobo !== 0)

  if (entries.length < 2 || entries.reduce((sum, entry) => sum + entry.deltaKobo, 0) !== 0) {
    throw new Error('Money transaction is not balanced')
  }

  const [existingRows] = await conn.execute<MoneyTransactionRow[]>(
    'SELECT * FROM money_transactions WHERE idempotency_key = ? FOR UPDATE',
    [input.idempotencyKey]
  )
  if (existingRows[0]) return { transaction: existingRows[0], created: false }

  const accountIds = entries.map((entry) => entry.accountId).sort((a, b) => a - b)
  const placeholders = accountIds.map(() => '?').join(',')
  const [accountRows] = await conn.execute<MoneyAccountRow[]>(
    `SELECT * FROM money_accounts WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
    accountIds
  )
  if (accountRows.length !== accountIds.length) throw new Error('A ledger account is missing')

  const accountById = new Map(accountRows.map((account) => [Number(account.id), account]))
  for (const entry of entries) {
    const account = accountById.get(entry.accountId)
    if (!account) throw new Error('A ledger account is missing')
    if (account.status !== 'active') throw new Error('A ledger account is frozen')

    const nextBalance = Number(account.balance_kobo) + entry.deltaKobo
    const protectedPurpose = ['available', 'escrow', 'withdrawal_reserved', 'fees', 'chargeback_reserve']
      .includes(account.purpose)
    if (protectedPurpose && nextBalance < 0) throw new Error('Insufficient available balance')
  }

  const [transactionResult] = await conn.execute<ResultSetHeader>(
    `INSERT INTO money_transactions (
       reference, idempotency_key, transaction_type, status, amount_kobo, currency,
       user_uid, booking_id, external_reference, metadata
     ) VALUES (?, ?, ?, 'success', ?, ?, ?, ?, ?, ?)`,
    [
      input.reference,
      input.idempotencyKey,
      input.type,
      input.amountKobo,
      CURRENCY,
      input.userUid || null,
      input.bookingId || null,
      input.externalReference || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  )
  const transactionId = transactionResult.insertId

  for (const entry of entries) {
    await conn.execute(
      'INSERT INTO money_entries (transaction_id, account_id, delta_kobo) VALUES (?, ?, ?)',
      [transactionId, entry.accountId, entry.deltaKobo]
    )
    await conn.execute(
      'UPDATE money_accounts SET balance_kobo = balance_kobo + ? WHERE id = ?',
      [entry.deltaKobo, entry.accountId]
    )
  }

  const [createdRows] = await conn.execute<MoneyTransactionRow[]>(
    'SELECT * FROM money_transactions WHERE id = ?',
    [transactionId]
  )
  return { transaction: createdRows[0], created: true }
}

export async function createFundingIntent(input: {
  userUid: string
  customerEmail: string
  amountKobo: number
}): Promise<{ reference: string }> {
  const reference = createMoneyReference('fund')
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const available = await userAccount(conn, input.userUid, 'available')
    await conn.execute('SELECT id FROM money_accounts WHERE id = ? FOR UPDATE', [available.id])
    const [dailyRows] = await conn.execute<(RowDataPacket & { total_kobo: number | string })[]>(
      `SELECT COALESCE(SUM(amount_kobo), 0) AS total_kobo
       FROM funding_intents
       WHERE user_uid = ? AND status IN ('initialized', 'success')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [input.userUid]
    )
    if (Number(dailyRows[0]?.total_kobo || 0) + input.amountKobo > DAILY_FUNDING_LIMIT_KOBO) {
      throw new Error('Daily wallet funding limit exceeded')
    }
    await conn.execute(
      `INSERT INTO funding_intents (
         reference, user_uid, customer_email, amount_kobo, currency, status
       ) VALUES (?, ?, ?, ?, ?, 'initialized')`,
      [reference, input.userUid, input.customerEmail.toLowerCase(), input.amountKobo, CURRENCY]
    )
    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
  return { reference }
}

export async function markFundingInitializationFailed(reference: string, reason: string): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.execute(
      `UPDATE funding_intents
       SET status = 'failed', failure_reason = ?
       WHERE reference = ? AND status = 'initialized'`,
      [reason.slice(0, 500), reference]
    )
  } finally {
    conn.release()
  }
}

export async function settleFunding(input: FundingSettlement): Promise<{ credited: boolean; userUid: string }> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [intentRows] = await conn.execute<FundingIntentRow[]>(
      'SELECT * FROM funding_intents WHERE reference = ? FOR UPDATE',
      [input.reference]
    )
    const intent = intentRows[0]
    if (!intent) throw new Error('Unknown funding reference')

    if (intent.status === 'success') {
      await conn.commit()
      return { credited: false, userUid: intent.user_uid }
    }
    if (intent.status !== 'initialized') throw new Error(`Funding intent is ${intent.status}`)
    const expectsLive = process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_') === true
    if ((expectsLive && input.domain !== 'live') || (!expectsLive && input.domain === 'live')) {
      throw new Error('Paystack mode mismatch')
    }
    if (input.currency !== CURRENCY) throw new Error('Unexpected payment currency')
    if (Number(intent.amount_kobo) !== input.amountKobo) throw new Error('Payment amount does not match funding intent')
    if (intent.customer_email.toLowerCase() !== input.customerEmail.trim().toLowerCase()) {
      throw new Error('Payment customer does not match funding intent')
    }
    if (input.userIdFromMetadata && input.userIdFromMetadata !== intent.user_uid) {
      throw new Error('Payment metadata does not match funding intent')
    }

    const available = await userAccount(conn, intent.user_uid, 'available')
    const clearing = await paystackClearingAccount(conn)
    const { transaction, created } = await postBalancedTransaction(conn, {
      reference: createMoneyReference('topup'),
      idempotencyKey: `paystack:charge:${input.reference}`,
      type: 'wallet_funding',
      amountKobo: input.amountKobo,
      userUid: intent.user_uid,
      externalReference: input.reference,
      metadata: {
        paystackTransactionId: input.transactionId ? String(input.transactionId) : null,
        channel: input.channel || null,
      },
      entries: [
        { accountId: available.id, deltaKobo: input.amountKobo },
        { accountId: clearing.id, deltaKobo: -input.amountKobo },
      ],
    })

    await conn.execute(
      `UPDATE funding_intents
       SET status = 'success', paystack_transaction_id = ?, channel = ?, paid_at = ?
       WHERE id = ?`,
      [
        input.transactionId ? String(input.transactionId) : null,
        input.channel || null,
        input.paidAt ? new Date(input.paidAt) : new Date(),
        intent.id,
      ]
    )
    await conn.commit()
    return { credited: created && Boolean(transaction.id), userUid: intent.user_uid }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function freezeFundingForDispute(reference: string): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [intentRows] = await conn.execute<FundingIntentRow[]>(
      'SELECT * FROM funding_intents WHERE reference = ? FOR UPDATE',
      [reference]
    )
    const intent = intentRows[0]
    if (!intent) throw new Error('Unknown disputed funding reference')
    const available = await userAccount(conn, intent.user_uid, 'available')
    await conn.execute(
      `UPDATE money_accounts SET status = 'frozen' WHERE id = ?`,
      [available.id]
    )
    await conn.execute(
      `UPDATE funding_intents
       SET status = 'disputed', failure_reason = 'Paystack dispute opened'
       WHERE id = ? AND status = 'success'`,
      [intent.id]
    )
    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function holdBookingFunds(
  conn: PoolConnection,
  input: {
    bookingId: number
    clientUid: string
    artisanUid: string
    amountKobo: number
  }
): Promise<void> {
  const [existingRows] = await conn.execute<BookingEscrowRow[]>(
    'SELECT * FROM booking_escrows_v2 WHERE booking_id = ? FOR UPDATE',
    [input.bookingId]
  )
  if (existingRows[0]) {
    if (
      Number(existingRows[0].amount_kobo) !== input.amountKobo ||
      existingRows[0].client_uid !== input.clientUid ||
      existingRows[0].artisan_uid !== input.artisanUid
    ) {
      throw new Error('Booking escrow already exists with different details')
    }
    return
  }

  const available = await userAccount(conn, input.clientUid, 'available')
  const escrow = await escrowAccount(conn, input.bookingId)
  const reference = createMoneyReference('hold')
  const posted = await postBalancedTransaction(conn, {
    reference,
    idempotencyKey: `booking:${input.bookingId}:hold`,
    type: 'booking_escrow_hold',
    amountKobo: input.amountKobo,
    userUid: input.clientUid,
    bookingId: input.bookingId,
    entries: [
      { accountId: available.id, deltaKobo: -input.amountKobo },
      { accountId: escrow.id, deltaKobo: input.amountKobo },
    ],
  })

  await conn.execute(
    `INSERT INTO booking_escrows_v2 (
       reference, booking_id, client_uid, artisan_uid, escrow_account_id, amount_kobo,
       platform_fee_kobo, status, hold_transaction_id
     ) VALUES (?, ?, ?, ?, ?, ?, 0, 'held', ?)`,
    [
      reference,
      input.bookingId,
      input.clientUid,
      input.artisanUid,
      escrow.id,
      input.amountKobo,
      posted.transaction.id,
    ]
  )
}

export async function releaseBookingFunds(conn: PoolConnection, bookingId: number): Promise<void> {
  const [rows] = await conn.execute<BookingEscrowRow[]>(
    'SELECT * FROM booking_escrows_v2 WHERE booking_id = ? FOR UPDATE',
    [bookingId]
  )
  const escrow = rows[0]
  if (!escrow) throw new Error('No held escrow exists for this booking')
  if (escrow.status === 'released') return
  if (escrow.status !== 'held') throw new Error(`Booking escrow is ${escrow.status}`)

  const amountKobo = Number(escrow.amount_kobo)
  const feeKobo = Math.round(amountKobo * PLATFORM_FEE_BPS / 10_000)
  const artisanKobo = amountKobo - feeKobo
  const artisanAvailable = await userAccount(conn, escrow.artisan_uid, 'available')
  const fees = await platformAccount(conn, 'fees')
  const releaseEntries = [
    { accountId: escrow.escrow_account_id, deltaKobo: -amountKobo },
    { accountId: artisanAvailable.id, deltaKobo: artisanKobo },
  ]
  if (feeKobo > 0) releaseEntries.push({ accountId: fees.id, deltaKobo: feeKobo })
  const posted = await postBalancedTransaction(conn, {
    reference: createMoneyReference('release'),
    idempotencyKey: `booking:${bookingId}:release`,
    type: 'booking_escrow_release',
    amountKobo,
    userUid: escrow.artisan_uid,
    bookingId,
    entries: releaseEntries,
  })

  await conn.execute(
    `UPDATE booking_escrows_v2
     SET status = 'released', platform_fee_kobo = ?, terminal_transaction_id = ?, released_at = NOW()
     WHERE id = ?`,
    [feeKobo, posted.transaction.id, escrow.id]
  )
}

export async function refundBookingFunds(conn: PoolConnection, bookingId: number): Promise<void> {
  const [rows] = await conn.execute<BookingEscrowRow[]>(
    'SELECT * FROM booking_escrows_v2 WHERE booking_id = ? FOR UPDATE',
    [bookingId]
  )
  const escrow = rows[0]
  if (!escrow) throw new Error('No held escrow exists for this booking')
  if (escrow.status === 'refunded') return
  if (escrow.status !== 'held') throw new Error(`Booking escrow is ${escrow.status}`)

  const amountKobo = Number(escrow.amount_kobo)
  const clientAvailable = await userAccount(conn, escrow.client_uid, 'available')
  const posted = await postBalancedTransaction(conn, {
    reference: createMoneyReference('refund'),
    idempotencyKey: `booking:${bookingId}:refund`,
    type: 'booking_escrow_refund',
    amountKobo,
    userUid: escrow.client_uid,
    bookingId,
    entries: [
      { accountId: escrow.escrow_account_id, deltaKobo: -amountKobo },
      { accountId: clientAvailable.id, deltaKobo: amountKobo },
    ],
  })

  await conn.execute(
    `UPDATE booking_escrows_v2
     SET status = 'refunded', terminal_transaction_id = ?, released_at = NOW()
     WHERE id = ?`,
    [posted.transaction.id, escrow.id]
  )
}

export async function reserveWithdrawal(input: {
  userUid: string
  amountKobo: number
  idempotencyKey: string
  bank: WithdrawalBankSnapshot
}): Promise<{ reference: string; status: string; created: boolean }> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [existingRows] = await conn.execute<WithdrawalV2Row[]>(
      `SELECT wr.*
       FROM withdrawal_requests_v2 wr
       JOIN money_transactions mt ON mt.id = wr.reserve_transaction_id
       WHERE mt.idempotency_key = ?
       FOR UPDATE`,
      [input.idempotencyKey]
    )
    if (existingRows[0]) {
      await conn.commit()
      return { reference: existingRows[0].reference, status: existingRows[0].status, created: false }
    }

    const available = await userAccount(conn, input.userUid, 'available')
    const reserved = await userAccount(conn, input.userUid, 'withdrawal_reserved')
    await conn.execute('SELECT id FROM money_accounts WHERE id = ? FOR UPDATE', [available.id])
    const [dailyRows] = await conn.execute<(RowDataPacket & { total_kobo: number | string })[]>(
      `SELECT COALESCE(SUM(amount_kobo), 0) AS total_kobo
       FROM withdrawal_requests_v2
       WHERE user_uid = ? AND status NOT IN ('failed', 'reversed')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [input.userUid]
    )
    if (Number(dailyRows[0]?.total_kobo || 0) + input.amountKobo > DAILY_WITHDRAWAL_LIMIT_KOBO) {
      throw new Error('Daily withdrawal limit exceeded')
    }
    const reference = createMoneyReference('wd')
    const posted = await postBalancedTransaction(conn, {
      reference: createMoneyReference('reserve'),
      idempotencyKey: input.idempotencyKey,
      type: 'withdrawal_reserve',
      amountKobo: input.amountKobo,
      userUid: input.userUid,
      externalReference: reference,
      entries: [
        { accountId: available.id, deltaKobo: -input.amountKobo },
        { accountId: reserved.id, deltaKobo: input.amountKobo },
      ],
    })
    if (!posted.created) {
      const [reservedRows] = await conn.execute<WithdrawalV2Row[]>(
        'SELECT * FROM withdrawal_requests_v2 WHERE reserve_transaction_id = ? FOR UPDATE',
        [posted.transaction.id]
      )
      const existing = reservedRows[0]
      if (!existing) throw new Error('Withdrawal reservation is incomplete and requires review')
      await conn.commit()
      return { reference: existing.reference, status: existing.status, created: false }
    }

    await conn.execute(
      `INSERT INTO withdrawal_requests_v2 (
         reference, user_uid, amount_kobo, currency, status, reserved_account_id,
         bank_name, bank_code, account_last4, account_name, recipient_code,
         reserve_transaction_id
       ) VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        input.userUid,
        input.amountKobo,
        CURRENCY,
        reserved.id,
        input.bank.bankName,
        input.bank.bankCode,
        input.bank.accountNumber.slice(-4),
        input.bank.accountName,
        input.bank.recipientCode,
        posted.transaction.id,
      ]
    )
    await conn.commit()
    return { reference, status: 'reserved', created: true }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function getWithdrawalForSubmission(reference: string): Promise<WithdrawalV2Row | null> {
  return queryOne<WithdrawalV2Row[]>(
    'SELECT * FROM withdrawal_requests_v2 WHERE reference = ?',
    [reference]
  )
}

export async function markWithdrawalSubmitted(
  reference: string,
  transferCode: string | null,
  paystackStatus: string
): Promise<void> {
  const normalized = paystackStatus === 'success' ? 'processing' : paystackStatus === 'pending' ? 'processing' : 'submitted'
  const conn = await getConnection()
  try {
    await conn.execute(
      `UPDATE withdrawal_requests_v2
       SET status = ?, transfer_code = COALESCE(?, transfer_code),
           attempt_count = attempt_count + 1, submitted_at = COALESCE(submitted_at, NOW()),
           failure_reason = NULL
       WHERE reference = ? AND status IN ('reserved', 'submitted', 'manual_review')`,
      [normalized, transferCode, reference]
    )
  } finally {
    conn.release()
  }
}

export async function markWithdrawalManualReview(reference: string, reason: string): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.execute(
      `UPDATE withdrawal_requests_v2
       SET status = 'manual_review', attempt_count = attempt_count + 1, failure_reason = ?
       WHERE reference = ? AND status NOT IN ('paid', 'failed', 'reversed')`,
      [reason.slice(0, 500), reference]
    )
  } finally {
    conn.release()
  }
}

export async function finalizeWithdrawal(input: {
  reference: string
  status: 'success' | 'failed' | 'reversed'
  amountKobo: number
  currency: string
  domain: string
  transferCode?: string
}): Promise<{ changed: boolean; userUid: string }> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<WithdrawalV2Row[]>(
      'SELECT * FROM withdrawal_requests_v2 WHERE reference = ? FOR UPDATE',
      [input.reference]
    )
    const withdrawal = rows[0]
    if (!withdrawal) throw new Error('Unknown withdrawal reference')
    const expectsLive = process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_') === true
    if ((expectsLive && input.domain !== 'live') || (!expectsLive && input.domain === 'live')) {
      throw new Error('Paystack mode mismatch')
    }
    if (Number(withdrawal.amount_kobo) !== input.amountKobo) throw new Error('Withdrawal amount mismatch')
    if (input.currency !== CURRENCY) throw new Error('Withdrawal currency mismatch')

    const terminal = ['paid', 'failed', 'reversed']
    if (terminal.includes(withdrawal.status)) {
      await conn.commit()
      return { changed: false, userUid: withdrawal.user_uid }
    }

    let posted
    if (input.status === 'success') {
      const clearing = await paystackClearingAccount(conn)
      posted = await postBalancedTransaction(conn, {
        reference: createMoneyReference('payout'),
        idempotencyKey: `paystack:transfer:${input.reference}:success`,
        type: 'withdrawal_paid',
        amountKobo: input.amountKobo,
        userUid: withdrawal.user_uid,
        externalReference: input.reference,
        entries: [
          { accountId: withdrawal.reserved_account_id, deltaKobo: -input.amountKobo },
          { accountId: clearing.id, deltaKobo: input.amountKobo },
        ],
      })
    } else {
      const available = await userAccount(conn, withdrawal.user_uid, 'available')
      posted = await postBalancedTransaction(conn, {
        reference: createMoneyReference('withdrawal_refund'),
        idempotencyKey: `paystack:transfer:${input.reference}:${input.status}`,
        type: input.status === 'reversed' ? 'withdrawal_reversed' : 'withdrawal_failed',
        amountKobo: input.amountKobo,
        userUid: withdrawal.user_uid,
        externalReference: input.reference,
        entries: [
          { accountId: withdrawal.reserved_account_id, deltaKobo: -input.amountKobo },
          { accountId: available.id, deltaKobo: input.amountKobo },
        ],
      })
    }

    const nextStatus = input.status === 'success' ? 'paid' : input.status
    await conn.execute(
      `UPDATE withdrawal_requests_v2
       SET status = ?, transfer_code = COALESCE(?, transfer_code),
           terminal_transaction_id = ?, completed_at = NOW(), failure_reason = NULL
       WHERE id = ?`,
      [nextStatus, input.transferCode || null, posted.transaction.id, withdrawal.id]
    )
    await conn.commit()
    return { changed: posted.created, userUid: withdrawal.user_uid }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export async function getMoneyWalletSnapshot(uid: string) {
  const user = await getUserRowByUid(uid)
  if (!user) throw new Error('User not found')

  const accounts = await query<MoneyAccountRow[]>(
    `SELECT * FROM money_accounts
     WHERE owner_type = 'user' AND owner_id = ? AND currency = 'NGN'`,
    [uid]
  )
  const byPurpose = new Map(accounts.map((account) => [account.purpose, account]))
  const available = byPurpose.get('available')
  const reserved = byPurpose.get('withdrawal_reserved')
  const availableKobo = Number(available?.balance_kobo || 0)

  const escrowRows = await query<(RowDataPacket & { held_kobo: number | string })[]>(
    `SELECT COALESCE(SUM(amount_kobo), 0) AS held_kobo
     FROM booking_escrows_v2 WHERE artisan_uid = ? AND status = 'held'`,
    [uid]
  )
  const earningsRows = await query<(RowDataPacket & { earned_kobo: number | string })[]>(
    `SELECT COALESCE(SUM(me.delta_kobo), 0) AS earned_kobo
     FROM money_entries me
     JOIN money_transactions mt ON mt.id = me.transaction_id
     JOIN money_accounts ma ON ma.id = me.account_id
     WHERE ma.owner_type = 'user' AND ma.owner_id = ? AND ma.purpose = 'available'
       AND mt.transaction_type = 'booking_escrow_release' AND me.delta_kobo > 0`,
    [uid]
  )

  const transactions = available
    ? await query<(RowDataPacket & {
        id: number
        reference: string
        transaction_type: string
        status: string
        amount_kobo: number | string
        delta_kobo: number | string
        metadata: string | null
        created_at: string
      })[]>(
        `SELECT mt.id, mt.reference, mt.transaction_type, mt.status, mt.amount_kobo,
                me.delta_kobo, mt.metadata, mt.created_at
         FROM money_entries me
         JOIN money_transactions mt ON mt.id = me.transaction_id
         WHERE me.account_id = ?
           AND mt.transaction_type <> 'withdrawal_reserve'
         ORDER BY mt.created_at DESC
         LIMIT 100`,
        [available.id]
      )
    : []

  const withdrawals = await query<(RowDataPacket & {
    id: number
    reference: string
    amount_kobo: number | string
    status: string
    bank_name: string
    account_last4: string
    created_at: string
  })[]>(
    `SELECT id, reference, amount_kobo, status, bank_name, account_last4, created_at
     FROM withdrawal_requests_v2 WHERE user_uid = ?
     ORDER BY created_at DESC LIMIT 100`,
    [uid]
  )

  const bankAccounts = await getWithdrawalAccounts(user.userId)
  const bankAccount = bankAccounts.length ? bankAccounts[bankAccounts.length - 1] : null

  const activity = [
    ...transactions.map((transaction) => ({
      id: `money-${transaction.id}`,
      type: mapTransactionType(transaction.transaction_type, Number(transaction.delta_kobo)),
      amountNGN: koboToNaira(Math.abs(Number(transaction.delta_kobo))),
      description: describeTransaction(transaction.transaction_type),
      status: transaction.status === 'success' ? 'success' : transaction.status,
      createdAt: transaction.created_at,
    })),
    ...withdrawals.map((withdrawal) => ({
      id: `withdrawal-v2-${withdrawal.id}`,
      type: 'debit',
      amountNGN: koboToNaira(withdrawal.amount_kobo),
      description: `Withdrawal to ${withdrawal.bank_name} ****${withdrawal.account_last4}`,
      status: withdrawal.status === 'paid'
        ? 'success'
        : ['failed', 'reversed'].includes(withdrawal.status) ? 'failed' : 'pending',
      createdAt: withdrawal.created_at,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 100)

  return {
    wallet: {
      id: available ? String(available.id) : null,
      userId: uid,
      availableBalance: koboToNaira(availableKobo),
      reservedWithdrawalBalance: koboToNaira(Number(reserved?.balance_kobo || 0)),
      escrowBalance: koboToNaira(Number(escrowRows[0]?.held_kobo || 0)),
      totalEarned: koboToNaira(Number(earningsRows[0]?.earned_kobo || 0)),
      isVerified: Boolean(bankAccount?.recipient_code),
      paystackRecipientCode: bankAccount?.recipient_code || null,
      bankName: bankAccount?.bank_name || null,
      bankCode: bankAccount?.bank_code || null,
      bankAccountNumber: bankAccount?.account_number ? `****${bankAccount.account_number.slice(-4)}` : null,
      createdAt: available?.created_at || null,
      updatedAt: available?.updated_at || null,
    },
    transactions: activity,
  }
}

function mapTransactionType(type: string, delta: number) {
  if (type === 'booking_escrow_release') return 'earning'
  if (type === 'booking_escrow_hold') return 'escrow_lock'
  if (type.includes('refund') || type.includes('reversed') || type.includes('failed')) return 'refund'
  return delta >= 0 ? 'credit' : 'debit'
}

function describeTransaction(type: string): string {
  const descriptions: Record<string, string> = {
    wallet_funding: 'Wallet funded via Paystack',
    booking_escrow_hold: 'Payment held for booking',
    booking_escrow_release: 'Booking earnings received',
    booking_escrow_refund: 'Booking payment refunded',
    withdrawal_reserve: 'Withdrawal requested',
    withdrawal_failed: 'Withdrawal returned',
    withdrawal_reversed: 'Withdrawal reversed',
    legacy_balance_import: 'Opening wallet balance',
  }
  return descriptions[type] || type.replaceAll('_', ' ')
}

export async function recordWebhookEvent(input: {
  rawBody: string
  eventType: string
  reference?: string
}): Promise<{ eventKey: string; duplicate: boolean }> {
  const eventKey = createHash('sha256').update(input.rawBody).digest('hex')
  const conn = await getConnection()
  try {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT IGNORE INTO payment_webhook_events (
         event_key, event_type, reference, payload, status
       ) VALUES (?, ?, ?, ?, 'received')`,
      [eventKey, input.eventType, input.reference || null, input.rawBody]
    )
    return { eventKey, duplicate: result.affectedRows === 0 }
  } finally {
    conn.release()
  }
}

export async function completeWebhookEvent(eventKey: string): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.execute(
      `UPDATE payment_webhook_events
       SET status = 'processed', attempt_count = attempt_count + 1,
           processed_at = NOW(), last_error = NULL
       WHERE event_key = ?`,
      [eventKey]
    )
  } finally {
    conn.release()
  }
}

export async function failWebhookEvent(eventKey: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : 'Webhook processing failed'
  const conn = await getConnection()
  try {
    await conn.execute(
      `UPDATE payment_webhook_events
       SET status = 'failed', attempt_count = attempt_count + 1, last_error = ?
       WHERE event_key = ?`,
      [message.slice(0, 1000), eventKey]
    )
  } finally {
    conn.release()
  }
}
