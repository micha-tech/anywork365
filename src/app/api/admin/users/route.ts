import { NextRequest, NextResponse } from 'next/server'
import { query, execute } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized, logAdminAction } from '@/lib/admin'
import { hardDeleteAccount } from '@/lib/account-delete'
import { buildAdminUserFilter } from '@/lib/admin-user-filters'

export async function GET(request: NextRequest) {
  try {
    await requireAdminApi()
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const offset = (page - 1) * limit

    const { where, params } = buildAdminUserFilter(search, role)

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
    } else if (act === 'delete') {
      if (uid === session.id) {
        return NextResponse.json({ success: false, error: 'Admins cannot delete their own account here' }, { status: 400 })
      }
      await hardDeleteAccount(uid)
      await logAdminAction(session.id, 'hard_delete_user', 'user', undefined, { note: 'User account permanently deleted' })
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
