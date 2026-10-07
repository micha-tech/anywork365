import { NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { getVerifiedSession } from '@/lib/auth'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

type Counts = {
  total: number
  active: number
  completed: number
  cancelled: number
  quotes: number
  acceptedQuotes: number
}

type CountRow = RowDataPacket & Counts

function rangeStart(weeksAgo: number): string {
  const now = new Date()
  const day = now.getUTCDay() || 7
  now.setUTCDate(now.getUTCDate() - day + 1 - weeksAgo * 7)
  now.setUTCHours(0, 0, 0, 0)
  return now.toISOString().slice(0, 19).replace('T', ' ')
}

async function clientCounts(uid: string, from: string, to: string): Promise<Counts> {
  const rows = await query<CountRow[]>(
    `SELECT COUNT(DISTINCT b.bookingId) AS total,
            SUM(CASE WHEN LOWER(b.bookingStatus) NOT IN ('closed', 'cancelled', 'canceled') THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN LOWER(b.bookingStatus) = 'closed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN LOWER(b.bookingStatus) IN ('cancelled', 'canceled') THEN 1 ELSE 0 END) AS cancelled,
            COUNT(DISTINCT q.id) AS quotes,
            SUM(CASE WHEN q.status = 'accepted' THEN 1 ELSE 0 END) AS acceptedQuotes
       FROM bookings b
       LEFT JOIN booking_quotes q ON q.booking_id = b.bookingId
      WHERE b.clientUID = ? AND b.dateBooked >= ? AND b.dateBooked < ?`,
    [uid, from, to]
  )
  return normalise(rows[0])
}

async function artisanCounts(uid: string, from: string, to: string): Promise<Counts> {
  const rows = await query<CountRow[]>(
    `SELECT COUNT(DISTINCT b.bookingId) AS total,
            SUM(CASE WHEN LOWER(b.bookingStatus) NOT IN ('closed', 'cancelled', 'canceled') THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN LOWER(b.bookingStatus) = 'closed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN LOWER(b.bookingStatus) IN ('cancelled', 'canceled') THEN 1 ELSE 0 END) AS cancelled,
            COUNT(DISTINCT q.id) AS quotes,
            SUM(CASE WHEN q.status = 'accepted' THEN 1 ELSE 0 END) AS acceptedQuotes
       FROM businesses bu
       LEFT JOIN bookings b ON b.businessId = bu.businessId AND b.dateBooked >= ? AND b.dateBooked < ?
       LEFT JOIN booking_quotes q ON q.booking_id = b.bookingId AND q.artisan_uid = ?
      WHERE bu.uid = ?`,
    [from, to, uid, uid]
  )
  return normalise(rows[0])
}

function normalise(row: Partial<Counts> | undefined): Counts {
  return {
    total: Number(row?.total || 0),
    active: Number(row?.active || 0),
    completed: Number(row?.completed || 0),
    cancelled: Number(row?.cancelled || 0),
    quotes: Number(row?.quotes || 0),
    acceptedQuotes: Number(row?.acceptedQuotes || 0),
  }
}

export async function GET() {
  const session = await getVerifiedSession()
  if (!session) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  if (session.role !== 'client' && session.role !== 'artisan') {
    return NextResponse.json({ success: false, error: 'Weekly reports are available to clients and artisans' }, { status: 403 })
  }

  const currentStart = rangeStart(0)
  const previousStart = rangeStart(1)
  const nextStart = rangeStart(-1)
  const getCounts = session.role === 'artisan' ? artisanCounts : clientCounts
  const [current, previous] = await Promise.all([
    getCounts(session.id, currentStart, nextStart),
    getCounts(session.id, previousStart, currentStart),
  ])

  return NextResponse.json({
    success: true,
    data: {
      role: session.role,
      period: { start: currentStart, end: nextStart },
      current,
      previous,
    },
  }, { headers: { 'Cache-Control': 'private, no-cache' } })
}
