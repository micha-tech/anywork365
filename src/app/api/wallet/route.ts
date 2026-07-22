import { NextResponse } from 'next/server'
import { getVerifiedSession } from '@/lib/auth'
import {
  getHeldEscrowBalance,
  getTotalWalletEarnings,
  getUserRowByUid,
  getUserWithdrawals,
  getWalletByUserId,
  getWalletBalance,
  getWalletLedger,
  getWithdrawalAccounts,
} from '@/lib/queries'
import type { ApiResponse } from '@/types'

export async function GET() {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const user = await getUserRowByUid(session.id)
  if (!user) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'User not found' },
      { status: 404 }
    )
  }

  const wallet = await getWalletByUserId(user.userId)
  if (!wallet) {
    return NextResponse.json(
      { success: true, data: { wallet: null, transactions: [] } },
      { status: 200 }
    )
  }

  const [balance, escrowBalance, totalEarned, ledger, accounts, withdrawals] = await Promise.all([
    getWalletBalance(wallet.id),
    session.role === 'artisan' ? getHeldEscrowBalance(wallet.id) : Promise.resolve(0),
    session.role === 'artisan' ? getTotalWalletEarnings(wallet.id) : Promise.resolve(0),
    getWalletLedger(wallet.id),
    getWithdrawalAccounts(user.userId),
    getUserWithdrawals(user.userId),
  ])
  const bankAccount = accounts.length > 0 ? accounts[accounts.length - 1] : null

  const ledgerTransactions = ledger
    .filter((entry) => !entry.description?.startsWith('Withdrawal to '))
    .map((entry) => {
      const description = entry.description ?? ''
      const type = description.startsWith('Job earnings -')
        ? 'earning' as const
        : description.includes('locked in escrow')
          ? 'escrow_lock' as const
          : /refund|reversal/i.test(description)
            ? 'refund' as const
            : entry.direction === 'credit'
              ? 'credit' as const
              : 'debit' as const

      return {
        id: `ledger-${entry.id}`,
        type,
        amountNGN: Number(entry.amount),
        description,
        status: 'success' as const,
        createdAt: entry.created_at,
      }
    })

  const withdrawalTransactions = withdrawals.map((withdrawal) => ({
    id: `withdrawal-${withdrawal.id}`,
    type: 'debit' as const,
    amountNGN: Number(withdrawal.amount),
    description: withdrawal.bank_name && withdrawal.account_number
      ? `Withdrawal to ${withdrawal.bank_name} ****${withdrawal.account_number.slice(-4)}`
      : 'Withdrawal request',
    status: withdrawal.status === 'paid'
      ? 'success' as const
      : withdrawal.status === 'failed'
        ? 'failed' as const
        : 'pending' as const,
    createdAt: withdrawal.created_at,
  }))

  const transactions = [...ledgerTransactions, ...withdrawalTransactions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100)

  return NextResponse.json(
    { success: true, data: {
      wallet: {
        id: String(wallet.id),
        userId: session.id,
        availableBalance: balance,
        escrowBalance,
        totalEarned,
        isVerified: !!bankAccount,
        paystackRecipientCode: bankAccount?.recipient_code || null,
        bankName: bankAccount?.bank_name || null,
        bankCode: bankAccount?.bank_code || null,
        bankAccountNumber: bankAccount?.account_number ? '****' + bankAccount.account_number.slice(-4) : null,
        createdAt: wallet.created_at,
        updatedAt: wallet.created_at,
      },
      transactions,
    }},
    { headers: { 'Cache-Control': 'private, no-cache' } }
  )
}
