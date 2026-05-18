import { NextRequest, NextResponse } from 'next/server'
import { query, type SqlValue } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized } from '@/lib/admin'

export async function GET(request: NextRequest) {
  try {
    await requireAdminApi()
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const status = searchParams.get('status') || ''
    const offset = (page - 1) * limit

    let where = ''
    const params: SqlValue[] = []
    if (status) {
      where = 'WHERE bv.status = ?'
      params.push(status)
    }

    const countRows = await query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM business_verifications bv ${where}`, params
    )
    const total = countRows[0]?.total ?? 0

    const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
      `SELECT bv.*, b.businessName, b.uid, b.category, b.state,
              u.fullName, u.email, u.phoneNumber
       FROM business_verifications bv
       JOIN businesses b ON b.businessId = bv.businessId
       JOIN users u ON u.uid = b.uid
       ${where}
       ORDER BY bv.submitted_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return NextResponse.json({ success: true, data: rows, total, page, limit })
  } catch (err) {
    console.error('admin verifications GET error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
