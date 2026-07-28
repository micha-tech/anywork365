/**
 * GET /api/wallet/verify?ref=REFERENCE
 * Paystack redirects here after payment
 * Verifies the transaction and credits the wallet
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyPayment } from '@/lib/paystack'
import { creditWallet, hasSuccessfulTransactionReference } from '@/lib/wallet'
import { getVerifiedSession } from '@/lib/auth'
import { isMoneyV2Enabled, koboToNaira, settleFunding } from '@/lib/money'
import {
  confirmExternalPayment,
  isMarketplaceFinanceEnabled,
} from '@/lib/financial/marketplace-service'

export async function GET(req: NextRequest) {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.redirect(
      new URL('/login', req.url)
    )
  }
  if (session.role !== 'client' && session.role !== 'artisan') {
    return NextResponse.redirect(new URL('/home', req.url))
  }

  const ref = req.nextUrl.searchParams.get('ref')
  const walletPath = session.role === 'artisan' ? '/dashboard/wallet' : '/wallet'

  if (!ref) {
    return NextResponse.redirect(
      new URL(`${walletPath}?status=error&msg=Missing+reference`, req.url)
    )
  }

  try {
    if (isMarketplaceFinanceEnabled()) {
      const confirmation = await confirmExternalPayment(ref, {
        type: 'user',
        id: session.id,
      })
      return NextResponse.redirect(
        new URL(
          `/dashboard/bookings?status=payment_success&bookingId=${confirmation.bookingId}`,
          req.url
        )
      )
    }

    const result = await verifyPayment(ref)

    if (result.data.status !== 'success') {
      return NextResponse.redirect(
        new URL(`${walletPath}?status=failed&ref=${ref}`, req.url)
      )
    }

    const { metadata, amount } = result.data
    const userId     = metadata?.userId
    const amountNGN  = koboToNaira(amount)

    if (!userId || userId !== session.id) {
      return NextResponse.redirect(
        new URL(`${walletPath}?status=error&msg=Invalid+payment+metadata`, req.url)
      )
    }

    if (isMoneyV2Enabled()) {
      await settleFunding({
        reference: ref,
        amountKobo: amount,
        currency: result.data.currency,
        domain: result.data.domain,
        customerEmail: result.data.customer.email,
        userIdFromMetadata: userId,
        transactionId: result.data.id,
        channel: result.data.channel,
        paidAt: result.data.paid_at,
      })
    } else if (!(await hasSuccessfulTransactionReference(ref))) {
      // Legacy credit path. The v2 path posts a balanced journal transaction.
      await creditWallet(userId, amountNGN, ref)
    }

    return NextResponse.redirect(
      new URL(`${walletPath}?status=success&amount=${amountNGN}`, req.url)
    )
  } catch (err) {
    console.error('[WALLET VERIFY]', err)
    return NextResponse.redirect(
      new URL(`${walletPath}?status=error&msg=Verification+failed`, req.url)
    )
  }
}
