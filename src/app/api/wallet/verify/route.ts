/**
 * GET /api/wallet/verify?ref=REFERENCE
 * Paystack redirects here after payment
 * Verifies the transaction and credits the wallet
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyPayment } from '@/lib/paystack'
import { creditWallet, hasSuccessfulTransactionReference } from '@/lib/wallet'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(
      new URL('/login', req.url)
    )
  }

  const ref = req.nextUrl.searchParams.get('ref')

  if (!ref) {
    return NextResponse.redirect(
      new URL('/dashboard/wallet?status=error&msg=Missing+reference', req.url)
    )
  }

  try {
    const result = await verifyPayment(ref)

    if (result.data.status !== 'success') {
      return NextResponse.redirect(
        new URL(`/dashboard/wallet?status=failed&ref=${ref}`, req.url)
      )
    }

    const { metadata, amount } = result.data
    const userId     = metadata?.userId
    const amountNGN  = Math.floor(amount / 100) // kobo → NGN

    if (!userId || userId !== session.id) {
      return NextResponse.redirect(
        new URL('/dashboard/wallet?status=error&msg=Invalid+payment+metadata', req.url)
      )
    }

    // Credit only once even if the redirect endpoint is refreshed or the webhook also fires.
    if (!(await hasSuccessfulTransactionReference(ref))) {
      await creditWallet(userId, amountNGN, ref)
    }

    return NextResponse.redirect(
      new URL(`/dashboard/wallet?status=success&amount=${amountNGN}`, req.url)
    )
  } catch (err) {
    console.error('[WALLET VERIFY]', err)
    return NextResponse.redirect(
      new URL('/dashboard/wallet?status=error&msg=Verification+failed', req.url)
    )
  }
}
