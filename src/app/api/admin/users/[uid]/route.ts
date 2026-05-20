import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized } from '@/lib/admin'

type AnyRow = RowDataPacket & Record<string, unknown>

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    await requireAdminApi()
    const { uid } = await params

    const user = await queryOne<AnyRow[]>(
      `SELECT u.*, b.businessName, b.category AS businessCategory, b.description AS businessDescription,
              b.location AS businessLocation, b.state AS businessState, b.verified AS businessVerified
       FROM users u
       LEFT JOIN businesses b ON b.uid = u.uid
       WHERE u.uid = ?`,
      [uid]
    )
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const wallet = await queryOne<AnyRow[]>(
      `SELECT w.id AS walletId, w.email AS walletEmail, w.currency, w.status AS walletStatus,
              COALESCE(SUM(CASE WHEN wl.direction = 'credit' THEN wl.amount ELSE -wl.amount END), 0) AS balance
       FROM wallets w
       LEFT JOIN wallet_ledger wl ON wl.wallet_id = w.id
       WHERE w.user_id = (SELECT userId FROM users WHERE uid = ?)
       GROUP BY w.id`,
      [uid]
    )

    const recentTransactions = await query<AnyRow[]>(
      `SELECT wl.* FROM wallet_ledger wl
       WHERE wl.wallet_id = (SELECT id FROM wallets WHERE user_id = (SELECT userId FROM users WHERE uid = ?) LIMIT 1)
       ORDER BY wl.id DESC LIMIT 20`,
      [uid]
    )

    const bookings = await query<AnyRow[]>(
      `SELECT b.bookingId, b.bookingCode, b.clientUID, b.businessId,
              b.bookingStatus, b.amountAgreed, b.dateBooked,
              bu.businessName AS serviceTitle
       FROM bookings b
       LEFT JOIN businesses bu ON bu.businessId = b.businessId
       WHERE b.clientUID = ?
       ORDER BY b.dateBooked DESC LIMIT 10`,
      [uid]
    )

    return NextResponse.json({ success: true, data: { user, wallet, recentTransactions, bookings } })
  } catch (err) {
    console.error('admin user detail GET error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
