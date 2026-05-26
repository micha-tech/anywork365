import {
  getUserRowByUid,
  getWalletByUserId,
  getOrCreateWallet as getOrCreateWalletDb,
  getWalletBalance,
  addLedgerEntry,
  createWalletTransaction,
  createWithdrawal,
  saveWithdrawalAccount,
  getWithdrawalAccounts,
  getUserWithdrawals,
  createDbNotification,
} from '@/lib/queries'
import { getConnection } from '@/lib/db'
import type { Wallet, WalletTransaction, WithdrawalRequest } from '@/types'
import { generateReference } from './paystack'

interface BankDetails {
  accountNumber: string
  bankCode: string
  bankName: string
  accountName: string
}

// ─── In-memory rate limiter ──────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 5

export function checkRateLimit(
  key: string,
  maxRequests = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (record.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) }
  }

  record.count++
  return { allowed: true }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

async function resolveUserWallet(uid: string): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getUserRowByUid>>>
  wallet: NonNullable<Awaited<ReturnType<typeof getWalletByUserId>>>
  walletId: number
}> {
  const user = await getUserRowByUid(uid)
  if (!user) throw new Error('User not found')

  let wallet = await getWalletByUserId(user.userId)
  if (!wallet) {
    wallet = await getOrCreateWalletDb(user.userId, user.email)
  }

  return { user, wallet, walletId: wallet.id }
}

// ─── Get or create wallet ───────────────────────────────────────────────

export async function getOrCreateWallet(uid: string): Promise<Wallet> {
  const { wallet } = await resolveUserWallet(uid)
  const balance = await getWalletBalance(wallet.id)

  return {
    userId: uid,
    availableBalance: balance,
    escrowBalance: 0,
    totalEarned: 0,
    isVerified: false,
    createdAt: wallet.created_at,
    updatedAt: wallet.created_at,
  }
}

// ─── Credit wallet after successful Paystack payment ────────────────────

export async function creditWallet(
  userId: string,
  amountNGN: number,
  reference: string,
  _isJobEarnings = false
): Promise<WalletTransaction> {
  // Resolve wallet outside the transaction (doesn't need serialization)
  const user = await getUserRowByUid(userId)
  if (!user) throw new Error('User not found')
  let wallet = await getWalletByUserId(user.userId)
  if (!wallet) {
    wallet = await getOrCreateWalletDb(user.userId, user.email)
  }
  const walletId = wallet.id

  const conn = await getConnection()
  try {
    await conn.execute('START TRANSACTION')

    // Lock row for this reference to prevent concurrent duplicates.
    // With connectionLimit:1 the pool serializes naturally, but this guards
    // against future pool size increases or dual-path (webhook + redirect) races.
    const [existing] = await conn.execute(
      'SELECT 1 FROM wallet_transactions WHERE reference = ? AND status = ? FOR UPDATE',
      [reference, 'success']
    ) as any
    if ((existing as any[]).length > 0) {
      await conn.execute('ROLLBACK')
      return {
        id: reference,
        userId,
        type: _isJobEarnings ? 'earning' : 'credit',
        amount: amountNGN * 100,
        amountNGN,
        description: _isJobEarnings ? 'Job earnings received' : 'Wallet funded via Paystack',
        reference,
        status: 'success',
        createdAt: new Date().toISOString(),
      }
    }

    const [balRows] = await conn.execute(
      'SELECT COALESCE(SUM(CASE WHEN direction = ? THEN amount ELSE -amount END), 0) AS balance FROM wallet_ledger WHERE wallet_id = ?',
      ['credit', walletId]
    ) as any
    const balance = (balRows[0]?.balance ?? 0) as number
    const newBalance = balance + amountNGN

    await conn.execute(
      `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [walletId, amountNGN, 'credit', newBalance, _isJobEarnings ? 'Job earnings received' : 'Wallet funded via Paystack']
    )

    await conn.execute(
      `INSERT INTO wallet_transactions (reference, type, status, metadata, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [reference, _isJobEarnings ? 'earning' : 'credit', 'success', JSON.stringify({ userId, source: 'paystack' })]
    )

    await conn.execute('COMMIT')

    const amountFormatted = `₦${amountNGN.toLocaleString()}`
    const notificationBody = _isJobEarnings
      ? `Job earnings of ${amountFormatted} received`
      : `Wallet funded with ${amountFormatted}`
    try {
      await createDbNotification(userId, notificationBody)
      const { sendPushNotification } = await import('./notifications')
      await sendPushNotification(userId, 'Anywork365', notificationBody)
    } catch {
      // Notifications are non-critical; silently ignore failures
    }

    return {
      id: reference,
      userId,
      type: _isJobEarnings ? 'earning' : 'credit',
      amount: amountNGN * 100,
      amountNGN,
      description: _isJobEarnings ? 'Job earnings received' : 'Wallet funded via Paystack',
      reference,
      status: 'success',
      createdAt: new Date().toISOString(),
    }
  } catch (err) {
    await conn.execute('ROLLBACK').catch(() => {})
    throw err
  } finally {
    conn.release()
  }
}

// ─── Check for duplicate reference (early-exit optimization) ────────────

export async function hasSuccessfulTransactionReference(
  reference: string
): Promise<boolean> {
  try {
    const { query } = await import('@/lib/db')
    const rows = await query(
      'SELECT 1 FROM wallet_transactions WHERE reference = ? AND status = ? LIMIT 1',
      [reference, 'success']
    ) as { '1'?: number }[]
    return rows.length > 0
  } catch (err) {
    console.error('[WALLET] hasSuccessfulTransactionReference error:', err)
    return false
  }
}

// ─── Delete bank account ────────────────────────────────────────────────

export async function deleteBankAccount(userId: string): Promise<void> {
  const userRow = await getUserRowByUid(userId)
  if (!userRow) throw new Error('User not found')
  const { execute } = await import('@/lib/db')
  await execute('DELETE FROM withdrawal_accounts WHERE user_id = ?', [userRow.userId])
}

// ─── Save bank account ──────────────────────────────────────────────────

export async function saveBankAccount(
  userId: string,
  bankDetails: {
    accountNumber: string
    bankCode: string
    bankName: string
    recipientCode: string
  }
): Promise<Wallet> {
  const userRow = await getUserRowByUid(userId)
  if (!userRow) throw new Error('User not found')

  await saveWithdrawalAccount({
    user_id: userRow.userId,
    bank_name: bankDetails.bankName,
    bank_code: bankDetails.bankCode,
    account_number: bankDetails.accountNumber,
    account_name: '',
  })

  return getOrCreateWallet(userId)
}

// ─── Request a withdrawal ───────────────────────────────────────────────

export async function requestWithdrawal(
  userId: string,
  amountNGN: number,
  bankDetails: BankDetails
): Promise<WithdrawalRequest | { error: string }> {
  const user = await getUserRowByUid(userId)
  if (!user) return { error: 'User not found' }

  let wallet = await getWalletByUserId(user.userId)
  if (!wallet) {
    wallet = await getOrCreateWalletDb(user.userId, user.email)
  }
  const walletId = wallet.id

  const conn = await getConnection()
  try {
    await conn.execute('START TRANSACTION')

    // Lock wallet ledger to serialize balance operations
    const [balRows] = await conn.execute(
      'SELECT COALESCE(SUM(CASE WHEN direction = ? THEN amount ELSE -amount END), 0) AS balance FROM wallet_ledger WHERE wallet_id = ? FOR UPDATE',
      ['credit', walletId]
    ) as any
    const balance = (balRows[0]?.balance ?? 0) as number

    if (amountNGN > balance) {
      await conn.execute('ROLLBACK')
      return { error: `Insufficient available balance` }
    }

    if (amountNGN < 500) {
      await conn.execute('ROLLBACK')
      return { error: 'Minimum withdrawal amount is ₦500' }
    }

    // Dedup: check for a pending withdrawal of the same amount within 5 minutes
    const [dupRows] = await conn.execute(
      `SELECT 1 FROM withdrawals WHERE user_id = ? AND amount = ? AND status = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) LIMIT 1`,
      [user.userId, amountNGN, 'pending']
    ) as any
    if ((dupRows as any[]).length > 0) {
      await conn.execute('ROLLBACK')
      return { error: 'A withdrawal request with the same amount is already being processed. Please wait.' }
    }

    const accounts = await getWithdrawalAccounts(user.userId)
    if (accounts.length === 0) {
      await conn.execute('ROLLBACK')
      return { error: 'Please verify your bank account before withdrawing' }
    }

    const newBalance = balance - amountNGN

    await conn.execute(
      `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [walletId, amountNGN, 'debit', newBalance, `Withdrawal to ${bankDetails.bankName} ••••${bankDetails.accountNumber.slice(-4)}`]
    )

    const [withdrawalResult] = await conn.execute(
      'INSERT INTO withdrawals (wallet_id, user_id, amount, account_id, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [walletId, user.userId, amountNGN, accounts[0].id, 'pending']
    ) as any
    const withdrawalId = withdrawalResult.insertId as number

    await conn.execute('COMMIT')

    return {
      id: String(withdrawalId),
      userId,
      amount: amountNGN,
      amountKobo: amountNGN * 100,
      bankAccountNumber: bankDetails.accountNumber,
      bankCode: bankDetails.bankCode,
      bankName: bankDetails.bankName,
      accountName: bankDetails.accountName,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  } catch (err) {
    await conn.execute('ROLLBACK').catch(() => {})
    console.error('[WITHDRAWAL REQUEST ERROR]', err)
    return { error: 'Withdrawal request failed. Please try again.' }
  } finally {
    conn.release()
  }
}

// ─── Rollback withdrawal ────────────────────────────────────────────────

export async function rollbackWithdrawal(
  withdrawalId: string,
  reason = 'Transfer failed'
): Promise<void> {
  const conn = await getConnection()
  try {
    await conn.execute('START TRANSACTION')

    const [rows] = await conn.execute(
      'SELECT * FROM withdrawals WHERE id = ? FOR UPDATE',
      [withdrawalId]
    ) as any
    const withdrawal = rows[0] as { user_id: number; amount: number; status: string; id: number } | undefined
    if (!withdrawal || withdrawal.status === 'failed') {
      await conn.execute('ROLLBACK')
      return
    }

    const [walletRows] = await conn.execute(
      'SELECT id FROM wallets WHERE user_id = ? AND wallet_type = ? FOR UPDATE',
      [withdrawal.user_id, 'user']
    ) as any
    if (walletRows.length === 0) {
      await conn.execute('ROLLBACK')
      return
    }
    const walletId = (walletRows[0] as { id: number }).id

    const [balRows] = await conn.execute(
      'SELECT COALESCE(SUM(CASE WHEN direction = ? THEN amount ELSE -amount END), 0) AS balance FROM wallet_ledger WHERE wallet_id = ?',
      ['credit', walletId]
    ) as any
    const balance = (balRows[0] as { balance: number } | undefined)?.balance ?? 0

    await conn.execute(
      'INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [walletId, withdrawal.amount, 'credit', balance + withdrawal.amount, `Withdrawal reversal - ${reason}`]
    )

    await conn.execute(
      'UPDATE withdrawals SET status = ? WHERE id = ?',
      ['failed', withdrawal.id]
    )

    await conn.execute('COMMIT')
  } catch (err) {
    await conn.execute('ROLLBACK').catch(() => {})
    console.error('[ROLLBACK WITHDRAWAL ERROR]', err)
  } finally {
    conn.release()
  }
}

// ─── Get withdrawal history ─────────────────────────────────────────────

export async function getUserWithdrawalsList(userId: string): Promise<WithdrawalRequest[]> {
  const user = await getUserRowByUid(userId)
  if (!user) return []

  const rows = await getUserWithdrawals(user.userId)
  return rows.map((r) => ({
    id: String(r.id),
    userId,
    amount: r.amount,
    amountKobo: r.amount * 100,
    bankAccountNumber: '',
    bankCode: '',
    bankName: '',
    accountName: '',
    status: r.status as WithdrawalRequest['status'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
}

// ─── Confirm withdrawal success ─────────────────────────────────────────

export async function confirmWithdrawalById(withdrawalId: string): Promise<void> {
  try {
    const { execute } = await import('@/lib/db')
    await execute('UPDATE withdrawals SET status = ? WHERE id = ? AND status = ?', ['paid', withdrawalId, 'pending'])
  } catch (err) {
    console.error('[CONFIRM WITHDRAWAL ERROR]', err)
  }
}

// ─── Get withdrawal by id ───────────────────────────────────────────────

export async function getWithdrawalById(withdrawalId: string): Promise<{ id: number; user_id: number; amount: number } | null> {
  try {
    const { query } = await import('@/lib/db')
    const rows = await query(
      'SELECT id, user_id, amount FROM withdrawals WHERE id = ?',
      [withdrawalId]
    ) as { id: number; user_id: number; amount: number }[]
    return rows[0] || null
  } catch (err) {
    console.error('[WALLET] getWithdrawalById error:', err)
    return null
  }
}

// ─── Lock escrow ────────────────────────────────────────────────────────

export async function lockEscrow(
  clientId: string,
  amountNGN: number,
  jobId: string
): Promise<WalletTransaction> {
  const { walletId } = await resolveUserWallet(clientId)

  const ref = generateReference('ESC')

  const conn = await getConnection()
  try {
    await conn.execute('START TRANSACTION')

    const [balRows] = await conn.execute(
      'SELECT COALESCE(SUM(CASE WHEN direction = ? THEN amount ELSE -amount END), 0) AS balance FROM wallet_ledger WHERE wallet_id = ? FOR UPDATE',
      ['credit', walletId]
    ) as any
    const balance = (balRows[0]?.balance ?? 0) as number

    if (amountNGN > balance) {
      await conn.execute('ROLLBACK')
      throw new Error('Insufficient balance to lock escrow')
    }

    const newBalance = balance - amountNGN

    await conn.execute(
      `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [walletId, amountNGN, 'debit', newBalance, `Payment locked in escrow for job #${jobId}`]
    )

    await conn.execute('COMMIT')

    return {
      id: ref,
      userId: clientId,
      type: 'escrow_lock',
      amount: amountNGN * 100,
      amountNGN,
      description: `Payment locked in escrow for job #${jobId}`,
      reference: ref,
      status: 'success',
      createdAt: new Date().toISOString(),
    }
  } catch (err) {
    await conn.execute('ROLLBACK').catch(() => {})
    throw err
  } finally {
    conn.release()
  }
}

// ─── Release escrow ─────────────────────────────────────────────────────

export async function releaseEscrow(
  clientId: string,
  proId: string,
  amountNGN: number,
  jobId: string
): Promise<{ clientTx: WalletTransaction; proTx: WalletTransaction }> {
  const { walletId: clientWalletId } = await resolveUserWallet(clientId)
  const { walletId: proWalletId } = await resolveUserWallet(proId)

  const PLATFORM_FEE_PERCENT = 5
  const platformFee = Math.round(amountNGN * PLATFORM_FEE_PERCENT / 100)
  const proAmount = amountNGN - platformFee

  const conn = await getConnection()
  try {
    await conn.execute('START TRANSACTION')

    // Lock both wallets
    const [clientBalRows] = await conn.execute(
      'SELECT COALESCE(SUM(CASE WHEN direction = ? THEN amount ELSE -amount END), 0) AS balance FROM wallet_ledger WHERE wallet_id = ? FOR UPDATE',
      ['credit', clientWalletId]
    ) as any
    const clientBalance = (clientBalRows[0]?.balance ?? 0) as number

    const [proBalRows] = await conn.execute(
      'SELECT COALESCE(SUM(CASE WHEN direction = ? THEN amount ELSE -amount END), 0) AS balance FROM wallet_ledger WHERE wallet_id = ? FOR UPDATE',
      ['credit', proWalletId]
    ) as any
    const proBalance = (proBalRows[0]?.balance ?? 0) as number

    await conn.execute(
      `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [clientWalletId, amountNGN, 'debit', clientBalance - amountNGN, `Escrow released for job #${jobId}`]
    )

    await conn.execute(
      `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [proWalletId, proAmount, 'credit', proBalance + proAmount, `Job earnings - job #${jobId}`]
    )

    await conn.execute('COMMIT')

    const ref = generateReference('REL')

    const clientTx: WalletTransaction = {
      id: ref,
      userId: clientId,
      type: 'escrow_release',
      amount: amountNGN * 100,
      amountNGN,
      description: `Escrow released for job #${jobId}`,
      reference: ref,
      status: 'success',
      createdAt: new Date().toISOString(),
    }

    const proTx: WalletTransaction = {
      id: generateReference('PAY'),
      userId: proId,
      type: 'earning',
      amount: proAmount * 100,
      amountNGN: proAmount,
      description: `Job earnings - job #${jobId}`,
      reference: generateReference('PAY'),
      status: 'success',
      createdAt: new Date().toISOString(),
    }

    return { clientTx, proTx }
  } catch (err) {
    await conn.execute('ROLLBACK').catch(() => {})
    throw err
  } finally {
    conn.release()
  }
}

// ─── Credit user for refund ─────────────────────────────────────────────

export async function creditUser(
  userId: string,
  amountNGN: number,
  reference: string,
  description: string
): Promise<WalletTransaction> {
  const { walletId } = await resolveUserWallet(userId)

  const conn = await getConnection()
  try {
    await conn.execute('START TRANSACTION')

    const [balRows] = await conn.execute(
      'SELECT COALESCE(SUM(CASE WHEN direction = ? THEN amount ELSE -amount END), 0) AS balance FROM wallet_ledger WHERE wallet_id = ? FOR UPDATE',
      ['credit', walletId]
    ) as any
    const balance = (balRows[0]?.balance ?? 0) as number

    await conn.execute(
      `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [walletId, amountNGN, 'credit', balance + amountNGN, description]
    )

    await conn.execute('COMMIT')

    return {
      id: reference,
      userId,
      type: 'refund',
      amount: amountNGN * 100,
      amountNGN,
      description,
      reference,
      status: 'success',
      createdAt: new Date().toISOString(),
    }
  } catch (err) {
    await conn.execute('ROLLBACK').catch(() => {})
    throw err
  } finally {
    conn.release()
  }
}
