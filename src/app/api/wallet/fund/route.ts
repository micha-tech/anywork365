/**
 * POST /api/wallet/fund
 * Initializes a Paystack payment to top up wallet
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { initializePayment, generateReference } from '@/lib/paystack'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'

const schema = z.object({
  amountNGN: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .min(100,        'Minimum top-up amount is ₦100')
    .max(10_000_000, 'Maximum single top-up is ₦10,000,000'),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const rateLimit = checkRateLimit(`fund:${session.id}`, 3, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many requests. Please wait ${rateLimit.retryAfter} seconds.` },
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
    const reference     = generateReference('FUND')
    const origin        = req.nextUrl.origin
    const callbackUrl   = `${origin}/api/wallet/verify?ref=${reference}`

    const result = await initializePayment({
      email: session.email,
      amountNGN,
      reference,
      callbackUrl,
      metadata: {
        userId:    session.id,
        type:      'wallet_fund',
        amountNGN: String(amountNGN),
      },
    })

    return NextResponse.json(
      { success: true, data: { authorizationUrl: result.data.authorization_url, reference, amountNGN } },
      { status: 200 }
    )
  } catch (err) {
    console.error('[WALLET FUND]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to initialize payment' },
      { status: 500 }
    )
  }
}
