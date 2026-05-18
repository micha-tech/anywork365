import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized, logAdminAction } from '@/lib/admin'

type AnyRow = RowDataPacket & Record<string, unknown>

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminApi()
    const { id } = await params
    const body = await request.json()
    const { action, adminNotes } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    const verification = await queryOne<AnyRow[]>(
      'SELECT * FROM business_verifications WHERE id = ?', [id]
    )
    if (!verification) {
      return NextResponse.json({ success: false, error: 'Verification not found' }, { status: 404 })
    }

    if (action === 'approve') {
      await execute(
        `UPDATE business_verifications SET status = 'approved', admin_notes = ?, reviewed_at = NOW() WHERE id = ?`,
        [adminNotes || null, id]
      )
      await execute('UPDATE businesses SET verified = 1 WHERE businessId = ?', [verification.businessId])
      await logAdminAction(session.id, 'approve_verification', 'verification', id, { businessId: verification.businessId })
    } else {
      await execute(
        `UPDATE business_verifications SET status = 'rejected', admin_notes = ?, reviewed_at = NOW() WHERE id = ?`,
        [adminNotes || null, id]
      )
      await logAdminAction(session.id, 'reject_verification', 'verification', id, { businessId: verification.businessId, adminNotes })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin verification POST error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
