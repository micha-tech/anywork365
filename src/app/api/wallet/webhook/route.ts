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
import {
  completeWebhookEvent,
  failWebhookEvent,
  finalizeWithdrawal,
  freezeFundingForDispute,
  isMoneyV2Enabled,
  recordWebhookEvent,
  settleFunding,
} from '@/lib/money'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { recordProviderEvent } from '@/lib/financial/provider-events'

function extractWithdrawalId(reference: string): string | null {
  if (!reference.toLowerCase().startsWith('wd_')) return null
  const parts = reference.split('_')
  return parts[1] || null
}

export async function POST(req: NextRequest) {
  let eventKey: string | null = null
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-paystack-signature') ?? ''

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('[WEBHOOK] Invalid signature - rejected')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    if (isMarketplaceFinanceEnabled()) {
      await recordProviderEvent({ rawBody, signature })
      // Acknowledge after durable storage. Verification and fulfilment run in the
      // authenticated worker, keeping this public endpoint fast and replay-safe.
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const event = JSON.parse(rawBody) as {
      event: string
      data: {
        status: string
        reference: string
        amount: number
        currency?: string
        domain?: string
        id?: number
        channel?: string
        paid_at?: string
        metadata?: Record<string, string>
        transfer_code?: string
        customer?: { email?: string }
        transaction?: { reference?: string }
      }
    }
    if (isMoneyV2Enabled()) {
      const recorded = await recordWebhookEvent({
        rawBody,
        eventType: event.event,
        reference: event.data.reference,
      })
      eventKey = recorded.eventKey
    }

    switch (event.event) {
      case 'charge.success': {
        const { reference, amount, metadata } = event.data
        const userId = metadata?.userId
        const type = metadata?.type
        const amountNGN = amount / 100

        if (isMoneyV2Enabled() && userId && type === 'wallet_fund') {
          await settleFunding({
            reference,
            amountKobo: amount,
            currency: event.data.currency || '',
            domain: event.data.domain || '',
            customerEmail: event.data.customer?.email || '',
            userIdFromMetadata: userId,
            transactionId: event.data.id,
            channel: event.data.channel,
            paidAt: event.data.paid_at,
          })
        } else if (userId && type === 'wallet_fund' && !(await hasSuccessfulTransactionReference(reference))) {
          await creditWallet(userId, amountNGN, reference)
        }
        break
      }

      case 'transfer.success': {
        const transferCode = event.data.transfer_code
        if (isMoneyV2Enabled()) {
          await finalizeWithdrawal({
            reference: event.data.reference,
            status: 'success',
            amountKobo: event.data.amount,
            currency: event.data.currency || '',
            domain: event.data.domain || '',
            transferCode,
          })
        } else {
          const withdrawalId = extractWithdrawalId(event.data.reference || '')
          if (withdrawalId) {
            await confirmWithdrawalById(withdrawalId)
          } else if (transferCode) {
            console.warn(`[WEBHOOK] Received transfer.success without WD_ reference, transferCode=${transferCode}`)
          }
        }
        break
      }

      case 'transfer.failed':
      case 'transfer.reversed': {
        const transferCode = event.data.transfer_code
        if (isMoneyV2Enabled()) {
          await finalizeWithdrawal({
            reference: event.data.reference,
            status: event.event === 'transfer.reversed' ? 'reversed' : 'failed',
            amountKobo: event.data.amount,
            currency: event.data.currency || '',
            domain: event.data.domain || '',
            transferCode,
          })
        } else {
          const withdrawalId = extractWithdrawalId(event.data.reference || '')
          if (withdrawalId) {
          await rollbackWithdrawal(withdrawalId, 'Transfer failed or reversed by Paystack')
          } else {
            console.warn(`[WEBHOOK] Transfer failed/reversed: ${transferCode}, no WD_ reference found`)
          }
        }
        break
      }

      case 'charge.dispute.create': {
        if (isMoneyV2Enabled()) {
          const disputedReference = event.data.transaction?.reference || event.data.reference
          if (!disputedReference) throw new Error('Dispute event has no transaction reference')
          await freezeFundingForDispute(disputedReference)
        }
        break
      }

      default:
        break
    }

    if (eventKey) await completeWebhookEvent(eventKey)
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    if (eventKey) await failWebhookEvent(eventKey, err).catch(() => undefined)
    console.error('[WEBHOOK ERROR]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
