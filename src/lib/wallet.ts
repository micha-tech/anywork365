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
import type { Wallet, WalletTransaction, WithdrawalRequest } from '@/types'
import { generateReference } from './paystack'

interface BankDetails {
  accountNumber: string
  bankCode: string
  bankName: string
  accountName: string
}

// ─── In-memory rate limiter (stays in-memory, no DB dependency) ──────────
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
  const { walletId } = await resolveUserWallet(userId)

  const balance = await getWalletBalance(walletId)
  const newBalance = balance + amountNGN

  await addLedgerEntry({
    wallet_id: walletId,
    amount: amountNGN,
    direction: 'credit',
    balance_after: newBalance,
    description: _isJobEarnings ? 'Job earnings received' : 'Wallet funded via Paystack',
  })

  await createWalletTransaction({
    reference,
    type: _isJobEarnings ? 'earning' : 'credit',
    status: 'success',
    metadata: JSON.stringify({ userId, source: 'paystack' }),
  })

  const amountFormatted = `₦${amountNGN.toLocaleString()}`
  const notificationBody = _isJobEarnings
    ? `Job earnings of ${amountFormatted} received`
    : `Wallet funded with ${amountFormatted}`
  try {
    await createDbNotification(userId, notificationBody)
    const { sendPushNotification } = await import('./notifications')
    await sendPushNotification(userId, 'Anywork365', notificationBody)
  } catch {
    // Notifications are non-critical; silently ignore if they fail
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
}

// ─── Check for duplicate reference ──────────────────────────────────────

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
  } catch {
    return false
  }
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
  const { user, walletId } = await resolveUserWallet(userId)

  const balance = await getWalletBalance(walletId)

  if (amountNGN > balance) {
    return { error: `Insufficient available balance` }
  }

  if (amountNGN < 500) {
    return { error: 'Minimum withdrawal amount is ₦500' }
  }

  const newBalance = balance - amountNGN

  const accounts = await getWithdrawalAccounts(user.userId)
  if (accounts.length === 0) {
    return { error: 'Please verify your bank account before withdrawing' }
  }

  await addLedgerEntry({
    wallet_id: walletId,
    amount: amountNGN,
    direction: 'debit',
    balance_after: newBalance,
    description: `Withdrawal to ${bankDetails.bankName} ••••${bankDetails.accountNumber.slice(-4)}`,
  })

  const withdrawalId = await createWithdrawal({
    user_id: user.userId,
    amount: amountNGN,
    account_id: accounts[0].id,
  })

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
}

// ─── Rollback withdrawal ────────────────────────────────────────────────

export async function rollbackWithdrawal(
  withdrawalId: string,
  reason = 'Transfer failed'
): Promise<void> {
  try {
    const { query, execute } = await import('@/lib/db')
    const rows = await query(
      'SELECT * FROM withdrawals WHERE id = ?',
      [withdrawalId]
    ) as { user_id: number; amount: number; status: string; id: number }[]
    const withdrawal = rows[0]
    if (!withdrawal || withdrawal.status === 'failed') return

    const wallet = await getWalletByUserId(withdrawal.user_id)
    if (!wallet) return

    const balance = await getWalletBalance(wallet.id)
    await addLedgerEntry({
      wallet_id: wallet.id,
      amount: withdrawal.amount,
      direction: 'credit',
      balance_after: balance + withdrawal.amount,
      description: `Withdrawal reversal - ${reason}`,
    })

    await execute(
      'UPDATE withdrawals SET status = ? WHERE id = ?',
      ['failed', withdrawal.id]
    )
  } catch (err) {
    console.error('[ROLLBACK WITHDRAWAL ERROR]', err)
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
  } catch {
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

  const balance = await getWalletBalance(walletId)
  const newBalance = balance - amountNGN

  await addLedgerEntry({
    wallet_id: walletId,
    amount: amountNGN,
    direction: 'debit',
    balance_after: newBalance,
    description: `Payment locked in escrow for job #${jobId}`,
  })

  const ref = generateReference('ESC')

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

  const clientBalance = await getWalletBalance(clientWalletId)
  await addLedgerEntry({
    wallet_id: clientWalletId,
    amount: amountNGN,
    direction: 'debit',
    balance_after: clientBalance - amountNGN,
    description: `Escrow released for job #${jobId}`,
  })

  const proBalance = await getWalletBalance(proWalletId)
  await addLedgerEntry({
    wallet_id: proWalletId,
    amount: proAmount,
    direction: 'credit',
    balance_after: proBalance + proAmount,
    description: `Job earnings - job #${jobId}`,
  })

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
}

// ─── Credit user for refund ─────────────────────────────────────────────

export async function creditUser(
  userId: string,
  amountNGN: number,
  reference: string,
  description: string
): Promise<WalletTransaction> {
  const { walletId } = await resolveUserWallet(userId)

  const balance = await getWalletBalance(walletId)
  await addLedgerEntry({
    wallet_id: walletId,
    amount: amountNGN,
    direction: 'credit',
    balance_after: balance + amountNGN,
    description,
  })

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
}
