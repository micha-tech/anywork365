import { NextRequest, NextResponse } from 'next/server'
import { query, execute, type SqlValue } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized, logAdminAction } from '@/lib/admin'

export async function GET(request: NextRequest) {
  try {
    await requireAdminApi()
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    const status = searchParams.get('status') || ''
    let where = ''
    const params: SqlValue[] = []
    if (status) {
      where = 'WHERE d.status = ?'
      params.push(status)
    }

    const countRows = await query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM disputes d ${where}`, params
    )
    const total = countRows[0]?.total ?? 0

    const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
      `SELECT d.*,
              cl.fullName AS clientName, cl.email AS clientEmail,
              vd.fullName AS vendorName, vd.email AS vendorEmail,
              rb.fullName AS raisedByName
       FROM disputes d
       LEFT JOIN users cl ON cl.uid = d.clientUid
       LEFT JOIN users vd ON vd.uid = d.vendorUid
       LEFT JOIN users rb ON rb.uid = d.raisedBy
       ${where}
       ORDER BY d.createdAt DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    )

    return NextResponse.json({ success: true, data: rows, total, page, limit })
  } catch (err) {
    console.error('admin disputes GET error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminApi()
    const body = await request.json()
    const { bookingId, clientUid, vendorUid, reason } = body

    if (!bookingId || !clientUid || !vendorUid || !reason) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const result = await execute(
      `INSERT INTO disputes (bookingId, clientUid, vendorUid, raisedBy, reason, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [bookingId, clientUid, vendorUid, session.id, reason]
    )

    await logAdminAction(session.id, 'create_dispute', 'dispute', String(result.insertId), { bookingId, reason })

    return NextResponse.json({ success: true, data: { id: result.insertId } })
  } catch (err) {
    console.error('admin disputes POST error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
