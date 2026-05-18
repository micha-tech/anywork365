import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized } from '@/lib/admin'

type CountRow = RowDataPacket & { count: number }
type TotalRow = RowDataPacket & { total: number }
type CountTotalRow = RowDataPacket & { count: number; total: number }

export async function GET() {
  try {
    await requireAdminApi()

    const totalUsers = await query<CountRow[]>('SELECT COUNT(*) AS count FROM users WHERE deleted = 0')
    const totalVendors = await query<CountRow[]>(
      "SELECT COUNT(*) AS count FROM users WHERE deleted = 0 AND (role = 'vendor' OR (role IS NULL AND hasBusinessAccount = 1))"
    )
    const totalClients = await query<CountRow[]>(
      "SELECT COUNT(*) AS count FROM users WHERE deleted = 0 AND (role = 'client' OR (role IS NULL AND hasBusinessAccount = 0))"
    )
    const totalAdmins = await query<CountRow[]>(
      "SELECT COUNT(*) AS count FROM users WHERE deleted = 0 AND role = 'admin'"
    )

    const totalBookings = await query<CountRow[]>('SELECT COUNT(*) AS count FROM bookings')
    const pendingBookings = await query<CountRow[]>(
      "SELECT COUNT(*) AS count FROM bookings WHERE bookingStatus = 'Active'"
    )
    const completedBookings = await query<CountRow[]>(
      "SELECT COUNT(*) AS count FROM bookings WHERE bookingStatus = 'Confirmed'"
    )

    const totalJobs = await query<CountRow[]>('SELECT COUNT(*) AS count FROM vacancies')
    const openJobs = await query<CountRow[]>(
      'SELECT COUNT(*) AS count FROM vacancies WHERE closed = 0'
    )

    const totalRevenue = await query<TotalRow[]>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_ledger WHERE direction = 'credit'"
    )
    const totalWithdrawn = await query<TotalRow[]>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_ledger WHERE direction = 'debit'"
    )

    const pendingVerifications = await query<CountRow[]>(
      "SELECT COUNT(*) AS count FROM business_verifications WHERE status = 'pending'"
    )

    const openDisputes = await query<CountRow[]>(
      "SELECT COUNT(*) AS count FROM disputes WHERE status IN ('open', 'investigating')"
    )

    const transactionsToday = await query<CountRow[]>(
      'SELECT COUNT(*) AS count FROM wallet_transactions WHERE DATE(created_at) = CURDATE()'
    )
    const usersToday = await query<CountRow[]>(
      'SELECT COUNT(*) AS count FROM users WHERE DATE(dateJoined) = CURDATE() AND deleted = 0'
    )

    const activeEscrows = await query<CountTotalRow[]>(
      "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM wallet_escrow WHERE status = 'held'"
    )

    return NextResponse.json({
      success: true,
      data: {
        users: { total: totalUsers[0]?.count ?? 0, vendors: totalVendors[0]?.count ?? 0, clients: totalClients[0]?.count ?? 0, admins: totalAdmins[0]?.count ?? 0 },
        bookings: { total: totalBookings[0]?.count ?? 0, pending: pendingBookings[0]?.count ?? 0, completed: completedBookings[0]?.count ?? 0 },
        jobs: { total: totalJobs[0]?.count ?? 0, open: openJobs[0]?.count ?? 0 },
        revenue: { total: totalRevenue[0]?.total ?? 0, withdrawn: totalWithdrawn[0]?.total ?? 0 },
        pendingVerifications: pendingVerifications[0]?.count ?? 0,
        openDisputes: openDisputes[0]?.count ?? 0,
        transactionsToday: transactionsToday[0]?.count ?? 0,
        usersToday: usersToday[0]?.count ?? 0,
        activeEscrows: { count: activeEscrows[0]?.count ?? 0, total: activeEscrows[0]?.total ?? 0 },
      }
    })
  } catch (err) {
    console.error('admin stats GET error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
