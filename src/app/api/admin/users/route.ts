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
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const offset = (page - 1) * limit

    let where = 'WHERE u.deleted = 0'
    const params: SqlValue[] = []

    if (search) {
      where += ' AND (u.fullName LIKE ? OR u.email LIKE ? OR u.uid LIKE ?)'
      const q = `%${search}%`
      params.push(q, q, q)
    }
    if (role === 'admin' || role === 'vendor' || role === 'client') {
      if (role === 'admin') {
        where += " AND u.role = 'admin'"
      } else if (role === 'vendor') {
        where += ' AND (u.role = ? OR (u.role IS NULL AND u.hasBusinessAccount = 1))'
        params.push('vendor')
      } else {
        where += ' AND (u.role = ? OR (u.role IS NULL AND u.hasBusinessAccount = 0))'
        params.push('client')
      }
    }

    const countRows = await query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM users u ${where}`, params
    )
    const total = countRows[0]?.total ?? 0

    const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
      `SELECT u.uid, u.email, u.fullName, u.phoneNumber, u.state,
              u.hasBusinessAccount, u.role, u.verified, u.suspended, u.dateJoined,
              COALESCE(w.availableBalance, 0) AS walletBalance
       FROM users u
       LEFT JOIN (
         SELECT w.user_id, SUM(CASE WHEN wl.direction = 'credit' THEN wl.amount ELSE -wl.amount END) AS availableBalance
         FROM wallet_ledger wl
         JOIN wallets w ON w.id = wl.wallet_id
         GROUP BY w.user_id
       ) w ON w.user_id = u.userId
       ${where}
       ORDER BY u.dateJoined DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    )

    return NextResponse.json({ success: true, data: rows, total, page, limit })
  } catch (err) {
    console.error('admin users GET error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdminApi()
    const body = await request.json()
    const { uid, action: act } = body

    if (!uid || !act) {
      return NextResponse.json({ success: false, error: 'Missing uid or action' }, { status: 400 })
    }

    if (act === 'suspend') {
      await execute('UPDATE users SET suspended = 1 WHERE uid = ?', [uid])
      await logAdminAction(session.id, 'suspend_user', 'user', uid)
    } else if (act === 'unsuspend') {
      await execute('UPDATE users SET suspended = 0 WHERE uid = ?', [uid])
      await logAdminAction(session.id, 'unsuspend_user', 'user', uid)
    } else if (act === 'set_role' && body.role) {
      if (!['client', 'vendor', 'admin'].includes(body.role)) {
        return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 })
      }
      await execute('UPDATE users SET role = ? WHERE uid = ?', [body.role, uid])
      await logAdminAction(session.id, 'set_role', 'user', uid, { role: body.role })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin users PATCH error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
