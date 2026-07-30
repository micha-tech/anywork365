import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAdminAction, requireAdminApi, unauthorized } from '@/lib/admin'
import { getConnection } from '@/lib/db'
import { requireFinancialPermission } from '@/lib/financial/admin-permissions'
import { FinancialError } from '@/lib/financial/errors'
import {
  isMarketplaceFinanceEnabled,
  requestJobRefundInTransaction,
} from '@/lib/financial/marketplace-service'

const schema = z.object({
  action: z.literal('request_refund'),
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
    const jobFundId = Number(id)
    if (!Number.isSafeInteger(jobFundId) || jobFundId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid job-fund ID' }, { status: 400 })
    }

    const conn = await getConnection()
    let result: Awaited<ReturnType<typeof requestJobRefundInTransaction>>
    let bookingId = 0
    try {
      await conn.beginTransaction()
      const [rows] = await conn.execute<import('mysql2/promise').RowDataPacket[]>(
        'SELECT booking_id FROM job_funds WHERE id = ? FOR UPDATE',
        [jobFundId]
      )
      bookingId = Number((rows[0] as { booking_id?: number } | undefined)?.booking_id || 0)
      if (!bookingId) throw new FinancialError('NOT_FOUND', 'Job funds were not found', 404)
      result = await requestJobRefundInTransaction(conn, {
        bookingId,
        requestedByUid: session.id,
        reason: `${parsed.data.reason} [${parsed.data.ticketReference}]`,
        actor: { type: 'admin', id: session.id },
      })
      await conn.commit()
    } catch (error) {
      await conn.rollback().catch(() => undefined)
      throw error
    } finally {
      conn.release()
    }

    await logAdminAction(session.id, 'request_job_refund', 'job_fund', id, {
      bookingId,
      reason: parsed.data.reason,
      ticketReference: parsed.data.ticketReference,
      refundReference: result.refundReference,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[MODERATION JOB REFUND]', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json(
      { success: false, error: error instanceof FinancialError ? error.message : 'Refund request failed' },
      { status: error instanceof FinancialError ? error.httpStatus : 500 }
    )
  }
}
