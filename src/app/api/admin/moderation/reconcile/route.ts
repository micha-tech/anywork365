import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAdminAction, requireAdminApi, unauthorized } from '@/lib/admin'
import { requireFinancialPermission } from '@/lib/financial/admin-permissions'
import { FinancialError } from '@/lib/financial/errors'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { runFinancialReconciliation } from '@/lib/financial/reconciliation-service'

const schema = z.object({
  reason: z.string().min(20).max(500),
  ticketReference: z.string().min(3).max(160),
})

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminApi()
    if (!isMarketplaceFinanceEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Marketplace finance is not enabled' },
        { status: 503 }
      )
    }
    await requireFinancialPermission(session.id, 'reconciliation.run')
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }
    const result = await runFinancialReconciliation(true)
    await logAdminAction(session.id, 'run_financial_reconciliation', 'finance', 'marketplace', {
      reason: parsed.data.reason,
      ticketReference: parsed.data.ticketReference,
      result,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[MODERATION RECONCILIATION]', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json(
      { success: false, error: error instanceof FinancialError ? error.message : 'Reconciliation failed' },
      { status: error instanceof FinancialError ? error.httpStatus : 500 }
    )
  }
}
