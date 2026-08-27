import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import {
  createDbNotification,
  getBookingQuotesByBookingIds,
  getBookingsByBusiness,
  getBookingsByClient,
  getBusinessByUid,
  getUserRowByUid,
} from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import { sendPushNotification } from '@/lib/notifications'
import { getConnection } from '@/lib/db'
import type { ApiResponse } from '@/types'
import type { ResultSetHeader } from 'mysql2/promise'

export const runtime = 'nodejs'

type BookingResponse = {
  id: number
  businessId: number
  clientUID: string
  businessName?: string
  clientName?: string
  description: string
  budget: number
  priceConfirmed: number
  date: string
  location: string
  inspectionMethod: 'none' | 'physical' | 'virtual'
  status: string
  clientDecision: string
  vendorDecision: string
  jobStatus: string
  createdAt: string
  meetingPoint: string
  reasonForCancellation: string
  quotes: Array<{
    id: number
    amount: number
    scope: string
    estimatedDuration: string | null
    proposedStartDate: string | null
    status: string
    respondedAt: string | null
    createdAt: string
    updatedAt: string
  }>
}

export async function GET() {
  const session = await getVerifiedSession()
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

  let bookings: BookingResponse[] = []

  if (session.role === 'artisan') {
    const business = await getBusinessByUid(session.id)
    if (business) {
      const rows = await getBookingsByBusiness(business.businessId)
      bookings = rows.map((r) => ({
        id: r.bookingId,
        businessId: r.businessId,
        clientUID: r.clientUID,
        clientName: r.fullName,
        description: r.additionalInfo,
        budget: Number(r.amountAgreed),
        priceConfirmed: r.priceConfirmed,
        date: r.bookedDate,
        location: r.appointmentAddress,
        inspectionMethod: r.inspectionMethod || 'none',
        status: mapStatus(r.bookingStatus),
        clientDecision: r.clientDecision,
        vendorDecision: r.vendorDecision,
        jobStatus: r.jobStatus,
        createdAt: r.dateBooked,
        meetingPoint: r.meetingPoint,
        reasonForCancellation: r.reasonForCancellation,
        quotes: [],
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
      budget: Number(r.amountAgreed),
      priceConfirmed: r.priceConfirmed,
      date: r.bookedDate,
      location: r.appointmentAddress,
      inspectionMethod: r.inspectionMethod || 'none',
      status: mapStatus(r.bookingStatus),
      clientDecision: r.clientDecision,
      vendorDecision: r.vendorDecision,
      jobStatus: r.jobStatus,
      createdAt: r.dateBooked,
      meetingPoint: r.meetingPoint,
      reasonForCancellation: r.reasonForCancellation,
      quotes: [],
    }))
  }

  const quoteRows = await getBookingQuotesByBookingIds(bookings.map((booking) => booking.id))
  const quotesByBooking = new Map<number, BookingResponse['quotes']>()
  for (const quote of quoteRows) {
    const bookingQuotes = quotesByBooking.get(quote.booking_id) ?? []
    bookingQuotes.push({
      id: quote.id,
      amount: Number(quote.amount),
      scope: quote.scope,
      estimatedDuration: quote.estimated_duration,
      proposedStartDate: quote.proposed_start_date,
      status: quote.status,
      respondedAt: quote.responded_at,
      createdAt: quote.created_at,
      updatedAt: quote.updated_at,
    })
    quotesByBooking.set(quote.booking_id, bookingQuotes)
  }
  bookings = bookings.map((booking) => ({
    ...booking,
    quotes: quotesByBooking.get(booking.id) ?? [],
  }))

  return NextResponse.json<ApiResponse<BookingResponse[]>>(
    { success: true, data: bookings },
    { status: 200 }
  )
}

export async function POST(req: NextRequest) {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  if (session.role === 'artisan') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only clients can book artisans' },
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Please check the booking details and try again.' },
      { status: 400 }
    )
  }

  const schema = z.object({
    vendorId: z.string().min(1, 'Artisan is required'),
    description: z.string().trim().min(1, 'Description is required').max(2000, 'Description must be under 2000 characters'),
    budget: z.number().int().min(1000, 'Minimum estimated budget is ₦1,000').max(10_000_000, 'Maximum estimated budget is ₦10,000,000'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid preferred date'),
    location: z.string().trim().max(500).optional().default(''),
    inspectionMethod: z.enum(['none', 'physical', 'virtual']).default('none'),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }
  const { vendorId, description, budget, date, location, inspectionMethod } = parsed.data

  const vendor = await getBusinessByUid(vendorId)
  if (!vendor) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Artisan not found' },
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

  const conn = await getConnection()
  try {
    const [bookingResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO bookings (
         businessId, clientUID, bookedDate, bookedTime, appointmentAddress,
         meetingPoint, inspectionMethod, additionalInfo, bookingStatus, vendorComment,
         amountAgreed, priceConfirmed, reasonForCancellation, dateBooked
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', '', ?, 0, '', NOW())`,
      [
        vendor.businessId,
        session.id,
        date,
        new Date().toLocaleTimeString('en-US', { hour12: false }),
        location,
        location,
        inspectionMethod,
        description,
        budget,
      ]
    )
    const bookingId = bookingResult.insertId

    const clientName = clientRow.fullName || 'A client'
    const inspectionLabel = inspectionMethod === 'physical'
      ? 'Physical inspection requested.'
      : inspectionMethod === 'virtual'
        ? 'Virtual inspection requested.'
        : 'No inspection requested.'
    const notificationBody = `${clientName} sent booking request #${bookingId}. ${inspectionLabel}`
    await Promise.allSettled([
      createDbNotification(vendorId, notificationBody),
      sendPushNotification(
        vendorId,
        'New Booking Request',
        notificationBody,
        { type: 'booking', bookingId: String(bookingId) }
      ),
    ])

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: true,
        data: {
          id: bookingId,
          vendorId,
          description,
          budget,
          date,
          location,
          inspectionMethod,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        message: 'Booking request sent. The artisan can now review it and send you a quote.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Booking creation error:', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'We could not send your booking request. Please try again.' },
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
