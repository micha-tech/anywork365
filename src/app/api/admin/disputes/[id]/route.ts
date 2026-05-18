import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'
import { requireAdminApi, unauthorized, logAdminAction } from '@/lib/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminApi()
    const { id } = await params
    const body = await request.json()
    const { status, resolution } = body

    if (!status || !['resolved', 'dismissed', 'investigating'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    if ((status === 'resolved' || status === 'dismissed') && !resolution) {
      return NextResponse.json({ success: false, error: 'Resolution required' }, { status: 400 })
    }

    if (status === 'resolved' || status === 'dismissed') {
      await execute(
        `UPDATE disputes SET status = ?, resolution = ?, resolvedBy = ?, resolvedAt = NOW() WHERE id = ?`,
        [status, resolution, session.id, id]
      )
    } else {
      await execute(
        `UPDATE disputes SET status = ? WHERE id = ?`,
        [status, id]
      )
    }

    await logAdminAction(session.id, `dispute_${status}`, 'dispute', id, { resolution })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin dispute PATCH error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
