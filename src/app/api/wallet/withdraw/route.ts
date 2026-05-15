/**
 * POST /api/wallet/withdraw
 * Professional requests a withdrawal to their verified bank account
 * Security checks: balance, minimum amount, verified bank account, rate limiting
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getOrCreateWallet, requestWithdrawal, rollbackWithdrawal } from '@/lib/wallet'
import { initiateTransfer } from '@/lib/paystack'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'

const schema = z.object({
  amountNGN: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .min(500,       'Minimum withdrawal is ₦500')
    .max(5_000_000, 'Maximum single withdrawal is ₦5,000,000'),
})

export async function POST(req: NextRequest) {
  let withdrawalId: string | null = null

  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (session.role !== 'vendor') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only vendors can withdraw funds' },
        { status: 403 }
      )
    }

    // Rate limiting: max 2 withdrawals per minute
    const rateLimit = checkRateLimit(`withdraw:${session.id}`, 2, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many withdrawal requests. Please wait ${rateLimit.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { amountNGN } = parsed.data
    const wallet        = await getOrCreateWallet(session.id)

    // Security: must have verified bank account
    if (!wallet.isVerified || !wallet.paystackRecipientCode) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Please add and verify a bank account before withdrawing' },
        { status: 400 }
      )
    }

    // Security: sufficient balance check
    if (amountNGN > wallet.availableBalance) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Insufficient balance. Available: ₦${wallet.availableBalance.toLocaleString()}` },
        { status: 400 }
      )
    }

    // Record the withdrawal (deducts from balance atomically)
    const result = await requestWithdrawal(session.id, amountNGN, {
      accountNumber: wallet.bankAccountNumber!,
      bankCode:      wallet.bankCode!,
      bankName:      wallet.bankName!,
      accountName:   `${session.firstName} ${session.lastName}`,
    })

    if ('error' in result) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    withdrawalId = result.id

    // Initiate Paystack transfer
    const transfer = await initiateTransfer({
      amountNGN,
      recipientCode: wallet.paystackRecipientCode,
      reference:     `WD_${withdrawalId}`,
      reason:        `Anywork365 withdrawal — ${session.firstName} ${session.lastName}`,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          withdrawalId:  result.id,
          transferCode:  transfer.data.transfer_code,
          amountNGN,
          status:        transfer.data.status,
          bank:          wallet.bankName,
          account:       `••••${wallet.bankAccountNumber!.slice(-4)}`,
        },
        message: 'Withdrawal initiated. Funds will arrive within 1-2 business days.',
      },
      { status: 200 }
    )
  } catch (err: unknown) {
    if (withdrawalId) {
      await rollbackWithdrawal(withdrawalId)
    }
    console.error('[WITHDRAWAL]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Withdrawal failed. Please try again.' },
      { status: 500 }
    )
  }
}
