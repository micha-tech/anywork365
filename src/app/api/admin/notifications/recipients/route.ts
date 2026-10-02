import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { requireAdminApi, unauthorized } from '@/lib/admin'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await requireAdminApi()
    const search = (new URL(request.url).searchParams.get('search') || '').trim().slice(0, 100)
    if (search.length < 2) return NextResponse.json({ success: true, data: [] })
    const term = `%${search}%`
    const rows = await query<(RowDataPacket & { uid: string; fullName: string | null; email: string; role: string | null })[]>(
      `SELECT uid, fullName, email, role FROM users
       WHERE deleted = 0 AND role NOT IN ('admin', 'support') AND (fullName LIKE ? OR email LIKE ?)
       ORDER BY fullName ASC, email ASC LIMIT 15`,
      [term, term]
    )
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    console.error('[ADMIN BROADCAST RECIPIENTS]', error)
    return NextResponse.json({ success: false, error: 'Could not search users' }, { status: 500 })
  }
}
