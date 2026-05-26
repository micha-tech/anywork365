import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized } from '@/lib/admin'
import { cachedQuery, CACHE_TAGS } from '@/lib/cache'

type CountRow = RowDataPacket & { count: number }
type TotalRow = RowDataPacket & { total: number }
type CountTotalRow = RowDataPacket & { count: number; total: number }
type StatsData = {
  users: { total: number; vendors: number; clients: number; admins: number }
  bookings: { total: number; pending: number; completed: number }
  jobs: { total: number; open: number }
  revenue: { total: number; withdrawn: number }
  pendingVerifications: number
  openDisputes: number
  transactionsToday: number
  usersToday: number
  activeEscrows: { count: number; total: number }
}

async function computeStats(): Promise<StatsData> {
  const [
    totalUsers, totalVendors, totalClients, totalAdmins,
    totalBookings, pendingBookings, completedBookings,
    totalJobs, openJobs,
    totalRevenue, totalWithdrawn,
    pendingVerifications,
    openDisputes,
    transactionsToday, usersToday,
    activeEscrows,
  ] = await Promise.all([
    query<CountRow[]>('SELECT COUNT(*) AS count FROM users WHERE deleted = 0'),
    query<CountRow[]>("SELECT COUNT(*) AS count FROM users WHERE deleted = 0 AND (role = 'vendor' OR (role IS NULL AND hasBusinessAccount = 1))"),
    query<CountRow[]>("SELECT COUNT(*) AS count FROM users WHERE deleted = 0 AND (role = 'client' OR (role IS NULL AND hasBusinessAccount = 0))"),
    query<CountRow[]>("SELECT COUNT(*) AS count FROM users WHERE deleted = 0 AND role = 'admin'"),
    query<CountRow[]>('SELECT COUNT(*) AS count FROM bookings'),
    query<CountRow[]>("SELECT COUNT(*) AS count FROM bookings WHERE bookingStatus = 'Active'"),
    query<CountRow[]>("SELECT COUNT(*) AS count FROM bookings WHERE bookingStatus = 'Confirmed'"),
    query<CountRow[]>('SELECT COUNT(*) AS count FROM vacancies'),
    query<CountRow[]>('SELECT COUNT(*) AS count FROM vacancies WHERE closed = 0'),
    query<TotalRow[]>("SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_ledger WHERE direction = 'credit'"),
    query<TotalRow[]>("SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_ledger WHERE direction = 'debit'"),
    query<CountRow[]>("SELECT COUNT(*) AS count FROM business_verifications WHERE status = 'pending'"),
    query<CountRow[]>("SELECT COUNT(*) AS count FROM disputes WHERE status IN ('open', 'investigating')"),
    query<CountRow[]>('SELECT COUNT(*) AS count FROM wallet_transactions WHERE DATE(created_at) = CURDATE()'),
    query<CountRow[]>('SELECT COUNT(*) AS count FROM users WHERE DATE(dateJoined) = CURDATE() AND deleted = 0'),
    query<CountTotalRow[]>("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM wallet_escrow WHERE status = 'held'"),
  ])

  return {
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
}

export async function GET() {
  try {
    await requireAdminApi()

    const data = await cachedQuery(computeStats, ['admin-stats'], [CACHE_TAGS.ADMIN_STATS], 60)

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('admin stats GET error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
