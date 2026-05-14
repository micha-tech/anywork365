import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUserRowByUid, getWalletByUserId, getWalletBalance, getWalletLedger, getWithdrawalAccounts } from '@/lib/queries'
import type { ApiResponse } from '@/types'

export async function GET() {
  const session = await getSession()
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

  const balance = await getWalletBalance(wallet.id)
  const ledger = await getWalletLedger(wallet.id)

  const accounts = await getWithdrawalAccounts(user.userId)
  const bankAccount = accounts.length > 0 ? accounts[accounts.length - 1] : null

  const transactions = ledger.map((entry) => ({
    id: String(entry.id),
    type: entry.direction === 'credit' ? 'credit' as const : 'debit' as const,
    amountNGN: entry.amount,
    description: entry.description ?? '',
    status: 'success' as const,
    createdAt: entry.created_at,
  }))

  return NextResponse.json({
    success: true,
    data: {
      wallet: {
        id: String(wallet.id),
        userId: session.id,
        availableBalance: balance,
        escrowBalance: 0,
        totalEarned: 0,
        isVerified: !!bankAccount,
        bankName: bankAccount?.bank_name || null,
        bankAccountNumber: bankAccount?.account_number || null,
        createdAt: wallet.created_at,
        updatedAt: wallet.created_at,
      },
      transactions,
    },
  })
}