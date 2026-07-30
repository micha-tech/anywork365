import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAdminAction, requireAdminApi, unauthorized } from '@/lib/admin'
import { requireFinancialPermission } from '@/lib/financial/admin-permissions'
import { FinancialError } from '@/lib/financial/errors'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { processRefundById } from '@/lib/financial/refund-service'

const schema = z.object({
  action: z.literal('submit'),
  reason: z.string().min(20).max(500),
  ticketReference: z.string().min(3).max(160),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminApi()
    if (!isMarketplaceFinanceEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Marketplace finance is not enabled' },
        { status: 503 }
      )
    }
    await requireFinancialPermission(session.id, 'refund.manage')
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }
    const { id } = await params
    const refundId = Number(id)
    if (!Number.isSafeInteger(refundId) || refundId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid refund ID' }, { status: 400 })
    }
    const result = await processRefundById(refundId)
    await logAdminAction(session.id, 'submit_refund_to_paystack', 'refund', id, {
      reason: parsed.data.reason,
      ticketReference: parsed.data.ticketReference,
      providerReference: result.providerReference,
      providerStatus: result.status,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[MODERATION REFUND SUBMISSION]', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json(
      { success: false, error: error instanceof FinancialError ? error.message : 'Refund submission failed' },
      { status: error instanceof FinancialError ? error.httpStatus : 500 }
    )
  }
}
