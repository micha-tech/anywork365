/**
 * GET /api/wallet/bank-account?accountNumber=...&bankCode=...
 * Preview account verification details without saving.
 *
 * POST /api/wallet/bank-account
 * Verifies and saves a vendor's bank account for withdrawals.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { resolveAccountNumber, createTransferRecipient } from '@/lib/paystack'
import { saveBankAccount } from '@/lib/wallet'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'

const schema = z.object({
  accountNumber: z.string().length(10, 'Account number must be 10 digits').regex(/^\d+$/, 'Account number must be numeric'),
  bankCode: z.string().min(1, 'Bank is required'),
  bankName: z.string().min(1, 'Bank name is required'),
})

const previewSchema = schema.pick({ accountNumber: true, bankCode: true })

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to verify bank account'
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 400 }
    )
  }
}

export async function POST(req: NextRequest) {
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
        { success: false, error: 'Only vendors can add bank accounts' },
        { status: 403 }
      )
    }

    // Rate limiting: max 3 bank account updates per minute
    const rateLimit = checkRateLimit(`bank:${session.id}`, 3, 60 * 1000)
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

    const recipient = await createTransferRecipient({ accountName, accountNumber, bankCode })
    const recipientCode = recipient.data.recipient_code

    const wallet = await saveBankAccount(session.id, {
      accountNumber,
      bankCode,
      bankName,
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
    const message = err instanceof Error ? err.message : 'Failed to verify bank account'
    console.error('[BANK ACCOUNT]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
