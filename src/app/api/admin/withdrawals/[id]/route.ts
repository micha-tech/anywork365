import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized, logAdminAction } from '@/lib/admin'
import { rollbackWithdrawal } from '@/lib/wallet'

type AnyRow = RowDataPacket & Record<string, unknown>

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminApi()
    const { id } = await params

    const withdrawal = await queryOne<AnyRow[]>(
      'SELECT * FROM withdrawals WHERE id = ?', [id]
    )
    if (!withdrawal) {
      return NextResponse.json({ success: false, error: 'Withdrawal not found' }, { status: 404 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'mark_paid') {
      await execute("UPDATE withdrawals SET status = 'paid' WHERE id = ?", [id])
      await logAdminAction(session.id, 'mark_withdrawal_paid', 'withdrawal', id)
    } else if (action === 'mark_failed') {
      await rollbackWithdrawal(id, body.reason || 'Transfer failed')
      await logAdminAction(session.id, 'mark_withdrawal_failed', 'withdrawal', id, { reason: body.reason })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin withdrawal POST error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
