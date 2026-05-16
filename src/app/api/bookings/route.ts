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
  getWalletBalance,
  addLedgerEntry,
  createEscrow,
} from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'
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

  const { query } = await import('@/lib/db')

  if (session.role === 'vendor') {
    const business = await getBusinessByUid(session.id)
    if (business) {
      const rows = await getBookingsByBusiness(business.businessId)
      const enriched = await Promise.all(rows.map(async (r) => {
        const client = await getUserRowByUid(r.clientUID)
        return {
          id: r.bookingId,
          businessId: r.businessId,
          clientUID: r.clientUID,
          clientName: client?.fullName || 'Unknown',
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
        }
      }))
      bookings = enriched
    }
  } else {
    const rows = await getBookingsByClient(session.id)
    const enriched = await Promise.all(rows.map(async (r) => {
      interface BusNameRow extends RowDataPacket { businessName: string }
      const busRows = await query<BusNameRow[]>('SELECT businessName FROM businesses WHERE businessId = ?', [r.businessId])
      const businessName = busRows.length > 0 ? busRows[0].businessName : 'Vendor'
      return {
        id: r.bookingId,
        businessId: r.businessId,
        clientUID: r.clientUID,
        businessName,
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
      }
    }))
    bookings = enriched
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

  const clientWallet = await getWalletByUserId(clientRow.userId) ?? await getOrCreateWalletDb(clientRow.userId, clientRow.email)

  const balance = await getWalletBalance(clientWallet.id)
  if (balance < budget) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: `Insufficient balance. You need ₦${budget.toLocaleString()} but your wallet has ₦${balance.toLocaleString()}. Please fund your wallet first.` },
      { status: 400 }
    )
  }

  const vendorRow = await getUserRowByUid(vendorId)
  let vendorWalletId: number | null = null
  if (vendorRow) {
    let vw = await getWalletByUserId(vendorRow.userId)
    if (!vw) {
      vw = await getOrCreateWalletDb(vendorRow.userId, vendorRow.email)
    }
    vendorWalletId = vw.id
  }

  const { execute } = await import('@/lib/db')
  const result = await execute(
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

  const bookingId = result.insertId

  const newBalance = balance - budget
  await addLedgerEntry({
    wallet_id: clientWallet.id,
    amount: budget,
    direction: 'debit',
    balance_after: newBalance,
    description: `Payment locked in escrow for booking #${bookingId}`,
  })

  if (vendorWalletId) {
    await createEscrow({
      booking_id: bookingId,
      client_wallet_id: clientWallet.id,
      vendor_wallet_id: vendorWalletId,
      amount: budget,
    })
  }

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
}

function mapStatus(db: string): string {
  if (db === 'Closed') return 'completed'
  if (db === 'Confirmed') return 'confirmed'
  if (db === 'Cancelled') return 'cancelled'
  return 'pending'
}
