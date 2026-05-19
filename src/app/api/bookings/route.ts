import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import {
  getBookingsByClient,
  getBookingsByBusiness,
  getBusinessByUid,
  getUserRowByUid,
  getWalletByUserId,
  getOrCreateWallet as getOrCreateWalletDb,
} from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import { sendPushNotification } from '@/lib/notifications'
import type { ApiResponse } from '@/types'
import type mysql from 'mysql2'
import type { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const userRow = await getUserRowByUid(session.id)
  if (!userRow) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'User not found' },
      { status: 404 }
    )
  }

  let bookings: any[] = []

  if (session.role === 'vendor') {
    const business = await getBusinessByUid(session.id)
    if (business) {
      const rows = await getBookingsByBusiness(business.businessId)
      bookings = rows.map((r) => ({
        id: r.bookingId,
        businessId: r.businessId,
        clientUID: r.clientUID,
        clientName: r.fullName,
        description: r.additionalInfo,
        budget: r.amountAgreed,
        priceConfirmed: r.priceConfirmed,
        date: r.bookedDate,
        location: r.appointmentAddress,
        status: mapStatus(r.bookingStatus),
        clientDecision: r.clientDecision,
        vendorDecision: r.vendorDecision,
        jobStatus: r.jobStatus,
        createdAt: r.dateBooked,
        meetingPoint: r.meetingPoint,
        reasonForCancellation: r.reasonForCancellation,
      }))
    }
  } else {
    const rows = await getBookingsByClient(session.id)
    bookings = rows.map((r) => ({
      id: r.bookingId,
      businessId: r.businessId,
      clientUID: r.clientUID,
      businessName: r.businessName,
      description: r.additionalInfo,
      budget: r.amountAgreed,
      priceConfirmed: r.priceConfirmed,
      date: r.bookedDate,
      location: r.appointmentAddress,
      status: mapStatus(r.bookingStatus),
      clientDecision: r.clientDecision,
      vendorDecision: r.vendorDecision,
      jobStatus: r.jobStatus,
      createdAt: r.dateBooked,
      meetingPoint: r.meetingPoint,
      reasonForCancellation: r.reasonForCancellation,
    }))
  }

  return NextResponse.json<ApiResponse<any>>(
    { success: true, data: bookings },
    { status: 200 }
  )
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  if (session.role === 'vendor') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only clients can book vendors' },
      { status: 403 }
    )
  }

  const rateLimit = checkRateLimit(`bookings:${session.id}`, 5, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.` },
      { status: 429 }
    )
  }

  const body = await req.json()
  const schema = z.object({
    vendorId: z.string().min(1, 'Vendor is required'),
    description: z.string().min(1, 'Description is required').max(2000, 'Description must be under 2000 characters'),
    budget: z.number().int().min(1000, 'Minimum booking budget is ₦1,000').max(10_000_000, 'Maximum booking budget is ₦10,000,000'),
    date: z.string().min(1, 'Date is required'),
    location: z.string().max(500).optional().default(''),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }
  const { vendorId, description, budget, date, location } = parsed.data

  const vendor = await getBusinessByUid(vendorId)
  if (!vendor) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Vendor not found' },
      { status: 404 }
    )
  }

  const clientRow = await getUserRowByUid(session.id)
  if (!clientRow) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'User not found' },
      { status: 404 }
    )
  }

  // Ensure wallets exist BEFORE the transaction (these may INSERT)
  const clientWallet = await getWalletByUserId(clientRow.userId) ?? await getOrCreateWalletDb(clientRow.userId, clientRow.email)

  const vendorRow = await getUserRowByUid(vendorId)
  let vendorWalletId: number | null = null
  if (vendorRow) {
    let vw = await getWalletByUserId(vendorRow.userId)
    if (!vw) {
      vw = await getOrCreateWalletDb(vendorRow.userId, vendorRow.email)
    }
    vendorWalletId = vw.id
  }

  // ── Transaction: atomic balance check + booking + escrow ──────────────
  const { getConnection } = await import('@/lib/db')
  const conn = await getConnection()
  try {
    await conn.beginTransaction()

    // Lock the client wallet row (prevents concurrent debits/credits)
    const [walletRows] = await conn.execute<RowDataPacket[]>(
      'SELECT id FROM wallets WHERE id = ? FOR UPDATE',
      [clientWallet.id]
    )
    if (walletRows.length === 0) {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      )
    }

    // Read current balance inside the transaction (sees all prior committed txns)
    const [balRows] = await conn.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS balance
       FROM wallet_ledger WHERE wallet_id = ?`,
      [clientWallet.id]
    )
    const currentBalance = Number(balRows[0]?.balance ?? 0)
    if (currentBalance < budget) {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Insufficient balance. You need ₦${budget.toLocaleString()} but your wallet has ₦${currentBalance.toLocaleString()}. Please fund your wallet first.` },
        { status: 400 }
      )
    }

    // INSERT booking
    const [bookingResult] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO bookings (businessId, clientUID, bookedDate, bookedTime, appointmentAddress, meetingPoint, additionalInfo, bookingStatus, amountAgreed, priceConfirmed, dateBooked)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, 1, NOW())`,
      [
        vendor.businessId,
        session.id,
        date,
        new Date().toLocaleTimeString('en-US', { hour12: false }),
        location || '',
        location || '',
        description,
        budget,
      ]
    )
    const bookingId = bookingResult.insertId

    // Debit client wallet (ledger entry)
    const newBalance = currentBalance - budget
    await conn.execute(
      `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
       VALUES (?, ?, 'debit', ?, ?, NOW())`,
      [clientWallet.id, budget, newBalance, `Payment locked in escrow for booking #${bookingId}`]
    )

    // Create escrow record
    if (vendorWalletId) {
      await conn.execute(
        `INSERT INTO wallet_escrow (booking_id, client_wallet_id, vendor_wallet_id, escrow_wallet_id, amount, status, created_at)
         VALUES (?, ?, ?, (SELECT id FROM wallets WHERE wallet_type = 'escrow' LIMIT 1), ?, 'held', NOW())`,
        [bookingId, clientWallet.id, vendorWalletId, budget]
      )
    }

    await conn.commit()

    await sendPushNotification(
      vendorId,
      'New Booking Request',
      `${clientRow.firstName} ${clientRow.lastName} wants to book your service — ₦${budget.toLocaleString()}`,
      { type: 'booking', bookingId: String(bookingId) }
    )

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: {
          id: bookingId,
          vendorId,
          description,
          budget,
          date,
          location,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        message: 'Booking request sent! The vendor will respond shortly.',
      },
      { status: 201 }
    )
  } catch (error) {
    await conn.rollback()
    console.error('Booking creation transaction error:', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to create booking. Please try again.' },
      { status: 500 }
    )
  } finally {
    conn.release()
  }
}

function mapStatus(db: string): string {
  if (db === 'Closed') return 'completed'
  if (db === 'Confirmed') return 'confirmed'
  if (db === 'Cancelled') return 'cancelled'
  return 'pending'
}
