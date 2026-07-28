import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { query } from '@/lib/db'
import { verifyPayment, verifyTransfer } from '@/lib/paystack'
import {
  finalizeWithdrawal,
  isMoneyV2Enabled,
  markWithdrawalManualReview,
  markWithdrawalSubmitted,
  markFundingInitializationFailed,
  settleFunding,
} from '@/lib/money'

function authorized(request: NextRequest): boolean {
  const configured = process.env.RECONCILIATION_SECRET || ''
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (configured.length < 32 || provided.length !== configured.length) return false
  return timingSafeEqual(Buffer.from(configured), Buffer.from(provided))
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!isMoneyV2Enabled()) {
    return NextResponse.json({ success: false, error: 'Money ledger v2 is disabled' }, { status: 409 })
  }

  const withdrawals = await query<(RowDataPacket & {
    reference: string
    status: string
  })[]>(
    `SELECT reference, status
     FROM withdrawal_requests_v2
     WHERE status IN ('submitted', 'processing', 'manual_review')
       AND updated_at <= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
     ORDER BY updated_at ASC
     LIMIT 50`
  )

  const results: Array<{ reference: string; status: string; outcome: string }> = []
  for (const withdrawal of withdrawals) {
    try {
      const verified = await verifyTransfer(withdrawal.reference)
      const paystackStatus = verified.data.status.toLowerCase()
      if (paystackStatus === 'success' || paystackStatus === 'failed' || paystackStatus === 'reversed') {
        await finalizeWithdrawal({
          reference: withdrawal.reference,
          status: paystackStatus,
          amountKobo: verified.data.amount,
          currency: verified.data.currency,
          domain: verified.data.domain,
          transferCode: verified.data.transfer_code,
        })
        results.push({ reference: withdrawal.reference, status: withdrawal.status, outcome: paystackStatus })
      } else {
        await markWithdrawalSubmitted(
          withdrawal.reference,
          verified.data.transfer_code || null,
          paystackStatus
        )
        results.push({ reference: withdrawal.reference, status: withdrawal.status, outcome: paystackStatus })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transfer verification failed'
      await markWithdrawalManualReview(withdrawal.reference, message)
      results.push({ reference: withdrawal.reference, status: withdrawal.status, outcome: 'manual_review' })
    }
  }

  const fundingIntents = await query<(RowDataPacket & {
    reference: string
    status: string
  })[]>(
    `SELECT reference, status
     FROM funding_intents
     WHERE status = 'initialized'
       AND created_at <= DATE_SUB(NOW(), INTERVAL 3 MINUTE)
     ORDER BY created_at ASC
     LIMIT 50`
  )
  for (const intent of fundingIntents) {
    try {
      const verified = await verifyPayment(intent.reference)
      if (verified.data.status === 'success') {
        await settleFunding({
          reference: intent.reference,
          amountKobo: verified.data.amount,
          currency: verified.data.currency,
          domain: verified.data.domain,
          customerEmail: verified.data.customer.email,
          userIdFromMetadata: verified.data.metadata?.userId,
          transactionId: verified.data.id,
          channel: verified.data.channel,
          paidAt: verified.data.paid_at,
        })
      } else if (verified.data.status === 'failed' || verified.data.status === 'abandoned') {
        await markFundingInitializationFailed(
          intent.reference,
          `Paystack transaction ${verified.data.status}`
        )
      }
      results.push({
        reference: intent.reference,
        status: intent.status,
        outcome: verified.data.status,
      })
    } catch {
      results.push({
        reference: intent.reference,
        status: intent.status,
        outcome: 'verification_unavailable',
      })
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  })
}
