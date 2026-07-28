/**
 * POST /api/wallet/withdraw
 * Artisan requests a withdrawal to their verified bank account
 * Security checks: balance, minimum amount, verified bank account, rate limiting
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import { getOrCreateWallet, requestWithdrawal, rollbackWithdrawal } from '@/lib/wallet'
import { initiateTransfer } from '@/lib/paystack'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'
import { getUserRowByUid, getWithdrawalAccounts } from '@/lib/queries'
import {
  checkDurableMoneyRateLimit,
  isMoneyV2Enabled,
  markWithdrawalManualReview,
  markWithdrawalSubmitted,
  nairaToKobo,
  reserveWithdrawal,
} from '@/lib/money'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { majorToMinor } from '@/lib/financial/money-value'
import {
  requestMarketplaceWithdrawal,
  submitMarketplaceWithdrawal,
} from '@/lib/financial/withdrawal-service'
import { FinancialError } from '@/lib/financial/errors'

const schema = z.object({
  amountNGN: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .min(500, 'Minimum withdrawal is ₦500')
    .max(5_000_000, 'Maximum single withdrawal is ₦5,000,000'),
  idempotencyKey: z.string().min(16).max(160).optional(),
})

export async function POST(req: NextRequest) {
  let withdrawalId: string | null = null

  try {
    const session = await getVerifiedSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (session.role !== 'artisan') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only artisans can withdraw funds' },
        { status: 403 }
      )
    }

    // Rate limiting: max 2 withdrawals per minute
    const rateLimit = isMarketplaceFinanceEnabled() || isMoneyV2Enabled()
      ? await checkDurableMoneyRateLimit(`withdraw:${session.id}`, 2, 60 * 1000)
      : checkRateLimit(`withdraw:${session.id}`, 2, 60 * 1000)
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

    if (isMarketplaceFinanceEnabled()) {
      const idempotencyKey = req.headers.get('idempotency-key') || parsed.data.idempotencyKey
      if (!idempotencyKey) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'A unique idempotency key is required' },
          { status: 400 }
        )
      }
      const userRow = await getUserRowByUid(session.id)
      if (!userRow?.verified || !userRow.nin) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Identity verification is required before withdrawing funds' },
          { status: 403 }
        )
      }
      const reserved = await requestMarketplaceWithdrawal({
        artisanUid: session.id,
        amountMinor: majorToMinor(String(amountNGN)),
        idempotencyKey,
        actor: { type: 'user', id: session.id },
      })
      const submitted = reserved.status === 'approved'
        ? await submitMarketplaceWithdrawal(
            reserved.reference,
            { type: 'system', id: 'automatic-withdrawal-policy' }
          )
        : { status: reserved.status, transferCode: null }
      return NextResponse.json(
        {
          success: true,
          data: {
            reference: reserved.reference,
            amountNGN,
            status: submitted.status,
            transferCode: submitted.transferCode,
            bank: reserved.recipient.bankName,
            account: `****${reserved.recipient.accountLastFour}`,
          },
          message: reserved.created
            ? submitted.status === 'under_review'
              ? 'Withdrawal is reserved and awaiting review. It will not be submitted twice.'
              : 'Withdrawal reserved and submitted for provider processing.'
            : 'This withdrawal request was already received.',
        },
        { status: 202 }
      )
    }

    if (isMoneyV2Enabled()) {
      const idempotencyKey = req.headers.get('idempotency-key') || parsed.data.idempotencyKey
      if (!idempotencyKey) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'A unique idempotency key is required' },
          { status: 400 }
        )
      }

      const userRow = await getUserRowByUid(session.id)
      if (!userRow) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }
      if (!userRow.verified || !userRow.nin) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Identity verification is required before withdrawing funds' },
          { status: 403 }
        )
      }
      const accounts = await getWithdrawalAccounts(userRow.userId)
      const account = accounts.length ? accounts[accounts.length - 1] : null
      if (!account?.recipient_code) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Please add and verify a bank account before withdrawing' },
          { status: 400 }
        )
      }
      const bankAccountAgeMs = Date.now() - new Date(account.created_at).getTime()
      if (!Number.isFinite(bankAccountAgeMs) || bankAccountAgeMs < 24 * 60 * 60 * 1000) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Withdrawals are available 24 hours after changing bank details' },
          { status: 403 }
        )
      }

      const amountKobo = nairaToKobo(amountNGN)
      const reserved = await reserveWithdrawal({
        userUid: session.id,
        amountKobo,
        idempotencyKey: `withdrawal:${session.id}:${idempotencyKey}`,
        bank: {
          bankName: account.bank_name,
          bankCode: account.bank_code,
          accountNumber: account.account_number,
          accountName: account.account_name,
          recipientCode: account.recipient_code,
        },
      })

      if (!reserved.created) {
        return NextResponse.json(
          {
            success: true,
            data: { reference: reserved.reference, amountNGN, status: reserved.status },
            message: 'This withdrawal request was already received.',
          },
          { status: 200 }
        )
      }

      try {
        const transfer = await initiateTransfer({
          amountKobo,
          recipientCode: account.recipient_code,
          reference: reserved.reference,
          reason: `Anywork365 withdrawal - ${session.firstName} ${session.lastName}`,
        })
        await markWithdrawalSubmitted(
          reserved.reference,
          transfer.data.transfer_code,
          transfer.data.status
        )
        return NextResponse.json(
          {
            success: true,
            data: {
              reference: reserved.reference,
              transferCode: transfer.data.transfer_code,
              amountNGN,
              status: 'processing',
              bank: account.bank_name,
              account: `****${account.account_number.slice(-4)}`,
            },
            message: 'Withdrawal submitted. Final status will be confirmed by Paystack.',
          },
          { status: 202 }
        )
      } catch (paystackError) {
        await markWithdrawalManualReview(
          reserved.reference,
          paystackError instanceof Error ? paystackError.message : 'Paystack response was inconclusive'
        )
        return NextResponse.json(
          {
            success: true,
            data: { reference: reserved.reference, amountNGN, status: 'manual_review' },
            message: 'Withdrawal is reserved and awaiting reconciliation. It has not been refunded or resubmitted.',
          },
          { status: 202 }
        )
      }
    }

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
        { success: false, error: 'Insufficient balance' },
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
      amountKobo: nairaToKobo(amountNGN),
      recipientCode: wallet.paystackRecipientCode,
      reference:     `wd_${withdrawalId}_${Date.now()}`,
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
      {
        success: false,
        error: err instanceof FinancialError ? err.message : 'Withdrawal failed. Please try again.',
      },
      { status: err instanceof FinancialError ? err.httpStatus : 500 }
    )
  }
}
