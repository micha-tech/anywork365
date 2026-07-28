/**
 * GET /api/wallet/bank-account?accountNumber=...&bankCode=...
 * Preview account verification details without saving.
 *
 * POST /api/wallet/bank-account
 * Verifies and saves a vendor's bank account for withdrawals.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import { resolveAccountNumber, createTransferRecipient } from '@/lib/paystack'
import { saveBankAccount, deleteBankAccount } from '@/lib/wallet'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'
import { checkDurableMoneyRateLimit, isMoneyV2Enabled } from '@/lib/money'
import { getUserRowByUid } from '@/lib/queries'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import {
  disableTransferRecipients,
  saveVerifiedTransferRecipient,
} from '@/lib/financial/withdrawal-service'

function normalizedNameTokens(value: string): Set<string> {
  return new Set(
    value.toLowerCase()
      .replace(/[^a-z\s'-]/g, ' ')
      .split(/\s+/)
      .map((token) => token.replace(/['-]/g, ''))
      .filter((token) => token.length > 1)
  )
}

function bankNameMatchesProfile(profileName: string, accountName: string): boolean {
  const profile = normalizedNameTokens(profileName)
  const account = normalizedNameTokens(accountName)
  if (profile.size === 0 || account.size === 0) return false
  const overlap = [...profile].filter((token) => account.has(token)).length
  return overlap >= Math.min(2, profile.size)
}

const schema = z.object({
  accountNumber: z.string().length(10, 'Account number must be 10 digits').regex(/^\d+$/, 'Account number must be numeric'),
  bankCode: z.string().min(1, 'Bank is required'),
  bankName: z.string().min(1, 'Bank name is required'),
})

const previewSchema = schema.pick({ accountNumber: true, bankCode: true })

export async function GET(req: NextRequest) {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }
  if (session.role !== 'artisan') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only artisans can manage withdrawal bank accounts' },
      { status: 403 }
    )
  }

  const parsed = previewSchema.safeParse({
    accountNumber: req.nextUrl.searchParams.get('accountNumber') ?? '',
    bankCode: req.nextUrl.searchParams.get('bankCode') ?? '',
  })

  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  try {
    const resolved = await resolveAccountNumber(parsed.data)
    return NextResponse.json(
      {
        success: true,
        data: {
          accountName: resolved.data.account_name,
          accountNumber: resolved.data.account_number,
        },
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to verify bank account' },
      { status: 400 }
    )
  }
}

export async function POST(req: NextRequest) {
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
        { success: false, error: 'Only artisans can add bank accounts' },
        { status: 403 }
      )
    }

    // Rate limiting: max 3 bank account updates per minute
    const durableMoney = isMarketplaceFinanceEnabled() || isMoneyV2Enabled()
    const rateLimit = durableMoney
      ? await checkDurableMoneyRateLimit(`bank:${session.id}`, 3, 60 * 1000)
      : checkRateLimit(`bank:${session.id}`, 3, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many requests. Please wait ${rateLimit.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { accountNumber, bankCode, bankName } = parsed.data
    const resolved = await resolveAccountNumber({ accountNumber, bankCode })
    const accountName = resolved.data.account_name

    if (durableMoney) {
      const user = await getUserRowByUid(session.id)
      if (!user?.verified || !user.nin) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Identity verification is required before adding a withdrawal account' },
          { status: 403 }
        )
      }
      if (!bankNameMatchesProfile(user.fullName, accountName)) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'The bank account name does not match your verified profile name' },
          { status: 400 }
        )
      }
    }

    const recipient = await createTransferRecipient({ accountName, accountNumber, bankCode })
    const recipientCode = recipient.data.recipient_code

    if (isMarketplaceFinanceEnabled()) {
      await saveVerifiedTransferRecipient({
        userUid: session.id,
        providerRecipientCode: recipientCode,
        bankCode,
        bankName,
        accountNumberLastFour: accountNumber.slice(-4),
        accountName,
        ownershipStatus: 'matched',
        actor: { type: 'user', id: session.id },
      })
      return NextResponse.json(
        {
          success: true,
          data: {
            accountName,
            bankName,
            accountNumber: `****${accountNumber.slice(-4)}`,
            isVerified: true,
          },
        },
        { status: 200 }
      )
    }

    const wallet = await saveBankAccount(session.id, {
      accountNumber,
      bankCode,
      bankName,
      accountName,
      recipientCode,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          accountName,
          bankName,
          accountNumber: `****${accountNumber.slice(-4)}`,
          isVerified: wallet.isVerified,
        },
      },
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error('[BANK ACCOUNT]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to save bank account' },
      { status: 400 }
    )
  }
}

export async function DELETE() {
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
        { success: false, error: 'Only artisans can remove bank accounts' },
        { status: 403 }
      )
    }

    if (isMarketplaceFinanceEnabled()) {
      await disableTransferRecipients(session.id, { type: 'user', id: session.id })
    } else {
      await deleteBankAccount(session.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[BANK ACCOUNT DELETE]', err)
    if (err instanceof Error && err.message.includes('while a withdrawal is pending')) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: err.message },
        { status: 409 }
      )
    }
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to remove bank account' },
      { status: 500 }
    )
  }
}
