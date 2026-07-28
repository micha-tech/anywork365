import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAdminAction, requireAdminApi, unauthorized } from '@/lib/admin'
import { createFinancialAdjustment } from '@/lib/financial/adjustment-service'
import { requireFinancialPermission } from '@/lib/financial/admin-permissions'
import { FinancialError } from '@/lib/financial/errors'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { majorToMinor } from '@/lib/financial/money-value'

const schema = z.object({
  targetUserUid: z.string().min(1).max(128),
  target: z.enum(['client_refundable', 'artisan_available_earnings']),
  direction: z.enum(['credit', 'debit']),
  amountNGN: z.string().regex(/^\d+(\.\d{1,2})?$/),
  reason: z.string().min(20).max(500),
  ticketReference: z.string().min(3).max(160),
  idempotencyKey: z.string().min(16).max(160),
})

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminApi()
    if (!isMarketplaceFinanceEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Marketplace finance v3 is disabled' },
        { status: 503 }
      )
    }
    await requireFinancialPermission(session.id, 'adjustment.create')
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }
    const key = `adjustment:${createHash('sha256')
      .update(`${session.id}:${parsed.data.idempotencyKey}`)
      .digest('hex')}`
    const result = await createFinancialAdjustment({
      ...parsed.data,
      amountMinor: majorToMinor(parsed.data.amountNGN),
      idempotencyKey: key,
      adminUid: session.id,
    })
    await logAdminAction(session.id, 'financial_adjustment', 'user', parsed.data.targetUserUid, {
      ...parsed.data,
      idempotencyKey: undefined,
      ledgerReference: result.reference,
    })
    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('[ADMIN FINANCE ADJUSTMENT]', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json(
      {
        success: false,
        error: error instanceof FinancialError ? error.message : 'Adjustment failed',
      },
      { status: error instanceof FinancialError ? error.httpStatus : 500 }
    )
  }
}
