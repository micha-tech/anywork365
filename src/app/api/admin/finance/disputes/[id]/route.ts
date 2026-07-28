import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAdminAction, requireAdminApi, unauthorized } from '@/lib/admin'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { recordChargeback } from '@/lib/financial/risk-service'
import { requireFinancialPermission } from '@/lib/financial/admin-permissions'

const schema = z.object({
  action: z.literal('record_chargeback'),
  reason: z.string().min(10).max(500),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminApi()
    if (!isMarketplaceFinanceEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Marketplace finance v3 is disabled' },
        { status: 503 }
      )
    }
    await requireFinancialPermission(session.id, 'dispute.chargeback')
    const { id } = await params
    const disputeId = Number(id)
    if (!Number.isSafeInteger(disputeId) || disputeId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid dispute ID' }, { status: 400 })
    }
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }
    const result = await recordChargeback(disputeId, session.id)
    await logAdminAction(session.id, parsed.data.action, 'financial_dispute', id, {
      reason: parsed.data.reason,
      chargebackReference: result.chargebackReference,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[ADMIN FINANCE DISPUTE]', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    )
  }
}
