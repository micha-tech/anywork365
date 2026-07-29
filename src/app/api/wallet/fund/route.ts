/**
 * POST /api/wallet/fund
 * Initializes a Paystack payment to top up wallet
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import { initializePayment, generateReference } from '@/lib/paystack'
import { checkRateLimit } from '@/lib/wallet'
import {
  createFundingIntent,
  checkDurableMoneyRateLimit,
  isMoneyV2Enabled,
  markFundingInitializationFailed,
  nairaToKobo,
} from '@/lib/money'
import type { ApiResponse } from '@/types'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { initializeWalletFunding } from '@/lib/financial/wallet-funding-service'
import { majorToMinor } from '@/lib/financial/money-value'
import { FinancialError } from '@/lib/financial/errors'

const schema = z.object({
  amountNGN: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .min(100,        'Minimum top-up amount is ₦100')
    .max(10_000_000, 'Maximum single top-up is ₦10,000,000'),
})

export async function POST(req: NextRequest) {
  let v2Reference: string | null = null
  try {
    const session = await getVerifiedSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (session.role !== 'client' && session.role !== 'artisan') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Wallets are only available to clients and artisans' },
        { status: 403 }
      )
    }

    const useMarketplaceFinance = isMarketplaceFinanceEnabled()
    if (useMarketplaceFinance && session.role !== 'client') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Only clients can fund a marketplace wallet.',
        },
        { status: 403 }
      )
    }

    const rateLimit = useMarketplaceFinance || isMoneyV2Enabled()
      ? await checkDurableMoneyRateLimit(`fund:${session.id}`, 3, 60 * 1000)
      : checkRateLimit(`fund:${session.id}`, 3, 60 * 1000)
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
    if (useMarketplaceFinance) {
      const result = await initializeWalletFunding({
        clientUid: session.id,
        customerEmail: session.email,
        amountMinor: majorToMinor(String(amountNGN)),
        callbackUrl: `${req.nextUrl.origin}/api/wallet/verify`,
      })
      return NextResponse.json(
        {
          success: true,
          data: {
            authorizationUrl: result.authorizationUrl,
            reference: result.reference,
            amountNGN,
          },
          message: 'Paystack checkout initialized. The wallet is credited only after verification.',
        },
        { status: 200 }
      )
    }

    const amountKobo = nairaToKobo(amountNGN)
    if (isMoneyV2Enabled()) {
      const intent = await createFundingIntent({
        userUid: session.id,
        customerEmail: session.email,
        amountKobo,
      })
      v2Reference = intent.reference
    }
    const reference = v2Reference || generateReference('FUND')
    const origin        = req.nextUrl.origin
    const callbackUrl   = `${origin}/api/wallet/verify?ref=${reference}`

    const result = await initializePayment({
      email: session.email,
      amountKobo,
      reference,
      callbackUrl,
      metadata: {
        userId:    session.id,
        type:      'wallet_fund',
        amountNGN: String(amountNGN),
        amountKobo: String(amountKobo),
      },
    })

    return NextResponse.json(
      { success: true, data: { authorizationUrl: result.data.authorization_url, reference, amountNGN } },
      { status: 200 }
    )
  } catch (err) {
    if (v2Reference) {
      await markFundingInitializationFailed(
        v2Reference,
        err instanceof Error ? err.message : 'Paystack initialization failed'
      ).catch(() => undefined)
    }
    console.error('[WALLET FUND]', err)
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: err instanceof FinancialError ? err.message : 'Failed to initialize payment',
      },
      { status: err instanceof FinancialError ? err.httpStatus : 500 }
    )
  }
}
