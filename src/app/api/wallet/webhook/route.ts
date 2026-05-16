/**
 * POST /api/wallet/webhook
 * Paystack sends signed events here for async confirmations
 * This handles: charge.success, transfer.success, transfer.failed
 *
 * Security: signature verified against PAYSTACK_SECRET_KEY
 * This endpoint must NOT require session auth - Paystack calls it server-to-server
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/paystack'
import { creditWallet, hasSuccessfulTransactionReference, confirmWithdrawalById, rollbackWithdrawal } from '@/lib/wallet'

function extractWithdrawalId(reference: string): string | null {
  if (!reference.startsWith('WD_')) return null
  const parts = reference.split('_')
  return parts[1] || null
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-paystack-signature') ?? ''

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('[WEBHOOK] Invalid signature - rejected')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody) as {
      event: string
      data: {
        status: string
        reference: string
        amount: number
        metadata?: Record<string, string>
        transfer_code?: string
      }
    }

    console.log(`[WEBHOOK] Event received: ${event.event}`)

    switch (event.event) {
      case 'charge.success': {
        const { reference, amount, metadata } = event.data
        const userId = metadata?.userId
        const type = metadata?.type
        const amountNGN = Math.floor(amount / 100)

        if (userId && type === 'wallet_fund' && !(await hasSuccessfulTransactionReference(reference))) {
          await creditWallet(userId, amountNGN, reference)
          console.log(`[WEBHOOK] Wallet credited: userId=${userId} amount=NGN ${amountNGN}`)
        }
        break
      }

      case 'transfer.success': {
        const transferCode = event.data.transfer_code
        const withdrawalId = extractWithdrawalId(event.data.reference || '')
        if (withdrawalId) {
          await confirmWithdrawalById(withdrawalId)
          console.log(`[WEBHOOK] Withdrawal confirmed: id=${withdrawalId}`)
        } else if (transferCode) {
          console.warn(`[WEBHOOK] Received transfer.success without WD_ reference, transferCode=${transferCode}`)
        }
        break
      }

      case 'transfer.failed':
      case 'transfer.reversed': {
        const transferCode = event.data.transfer_code
        const withdrawalId = extractWithdrawalId(event.data.reference || '')
        if (withdrawalId) {
          await rollbackWithdrawal(withdrawalId, 'Transfer failed or reversed by Paystack')
          console.log(`[WEBHOOK] Withdrawal rolled back: id=${withdrawalId}`)
        } else {
          console.warn(`[WEBHOOK] Transfer failed/reversed: ${transferCode}, no WD_ reference found`)
        }
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
