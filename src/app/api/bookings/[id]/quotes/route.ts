import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getVerifiedSession } from '@/lib/auth'
import { getConnection } from '@/lib/db'
import { checkRateLimit } from '@/lib/wallet'
import { createDbNotification } from '@/lib/queries'
import { sendPushNotification } from '@/lib/notifications'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

type BookingAccessRow = RowDataPacket & {
  bookingId: number
  clientUID: string
  bookingStatus: string
  businessUid: string
}

type QuoteAccessRow = BookingAccessRow & {
  quoteId: number
  artisanUid: string
  quoteAmount: number | string
  quoteStatus: string
}

function parseBookingId(value: string): number | null {
  const id = Number.parseInt(value, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }
  if (session.role !== 'artisan') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only the assigned artisan can send a quote.' },
      { status: 403 }
    )
  }

  const rateLimit = checkRateLimit(`booking-quote:${session.id}`, 10, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.` },
      { status: 429 }
    )
  }

  const { id } = await params
  const bookingId = parseBookingId(id)
  if (!bookingId) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Booking request not found.' },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Please check the quote details and try again.' },
      { status: 400 }
    )
  }
  const parsed = z.object({
    amount: z.number().int().min(1000, 'Minimum quote is ₦1,000').max(10_000_000, 'Maximum quote is ₦10,000,000'),
    scope: z.string().trim().min(10, 'Add a little more detail about what the quote covers.').max(2000, 'Scope must be under 2000 characters.'),
    estimatedDuration: z.string().trim().max(120).optional().nullable(),
    proposedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid proposed start date').optional().nullable(),
  }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const conn = await getConnection()
  let clientUid = ''
  let quoteId = 0
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<BookingAccessRow[]>(
      `SELECT b.bookingId, b.clientUID, b.bookingStatus, bus.uid AS businessUid
       FROM bookings b
       JOIN businesses bus ON bus.businessId = b.businessId
       WHERE b.bookingId = ?
       FOR UPDATE`,
      [bookingId]
    )
    const booking = rows[0]
    if (!booking) {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Booking request not found.' },
        { status: 404 }
      )
    }
    if (booking.businessUid !== session.id) {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'This booking request is assigned to another artisan.' },
        { status: 403 }
      )
    }
    if (booking.bookingStatus !== 'Pending') {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Quotes can only be sent for pending booking requests.' },
        { status: 409 }
      )
    }

    await conn.execute(
      `UPDATE booking_quotes
       SET status = 'superseded', updated_at = NOW()
       WHERE booking_id = ? AND status = 'pending'`,
      [bookingId]
    )
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO booking_quotes (
         booking_id, artisan_uid, amount, scope, estimated_duration,
         proposed_start_date, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        bookingId,
        session.id,
        parsed.data.amount,
        parsed.data.scope,
        parsed.data.estimatedDuration || null,
        parsed.data.proposedStartDate || null,
      ]
    )
    quoteId = result.insertId
    clientUid = booking.clientUID
    await conn.execute(
      `UPDATE bookings SET vendorDecision = 'Quoted', clientDecision = '' WHERE bookingId = ?`,
      [bookingId]
    )
    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => {})
    console.error('[BOOKING QUOTE CREATE]', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'We could not send this quote. Please try again.' },
      { status: 500 }
    )
  } finally {
    conn.release()
  }

  const notificationBody = `You received a ₦${parsed.data.amount.toLocaleString()} quote for booking #${bookingId}.`
  await Promise.allSettled([
    createDbNotification(clientUid, notificationBody),
    sendPushNotification(clientUid, 'New Quote Received', notificationBody, {
      type: 'booking',
      bookingId: String(bookingId),
    }),
  ])

  return NextResponse.json<ApiResponse<unknown>>(
    {
      success: true,
      data: {
        id: quoteId,
        bookingId,
        amount: parsed.data.amount,
        scope: parsed.data.scope,
        estimatedDuration: parsed.data.estimatedDuration || null,
        proposedStartDate: parsed.data.proposedStartDate || null,
        status: 'pending',
      },
      message: 'Quote sent to the client.',
    },
    { status: 201 }
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }
  if (session.role === 'artisan') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only the client can accept or reject a quote.' },
      { status: 403 }
    )
  }

  const rateLimit = checkRateLimit(`booking-quote-response:${session.id}`, 10, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.` },
      { status: 429 }
    )
  }

  const { id } = await params
  const bookingId = parseBookingId(id)
  if (!bookingId) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Booking request not found.' },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Please choose whether to accept or reject this quote.' },
      { status: 400 }
    )
  }
  const parsed = z.object({
    quoteId: z.number().int().positive(),
    action: z.enum(['accept', 'reject']),
    rejectionReason: z.enum(['price', 'scope', 'timeline', 'materials', 'inspection', 'other']).optional(),
    rejectionNote: z.string().trim().max(1000, 'Feedback must be under 1000 characters.').optional(),
  }).superRefine((value, context) => {
    if (value.action === 'reject' && !value.rejectionReason) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['rejectionReason'], message: 'Choose what should be changed.' })
    }
    if (value.action === 'reject' && (!value.rejectionNote || value.rejectionNote.length < 5)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['rejectionNote'], message: 'Tell the artisan what should be changed.' })
    }
  }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: parsed.error.errors[0]?.message || 'Please choose whether to accept or request changes.' },
      { status: 400 }
    )
  }

  const conn = await getConnection()
  let artisanUid = ''
  let amount = 0
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<QuoteAccessRow[]>(
      `SELECT q.id AS quoteId, q.artisan_uid AS artisanUid,
              q.amount AS quoteAmount, q.status AS quoteStatus,
              b.bookingId, b.clientUID, b.bookingStatus, bus.uid AS businessUid
       FROM booking_quotes q
       JOIN bookings b ON b.bookingId = q.booking_id
       JOIN businesses bus ON bus.businessId = b.businessId
       WHERE q.id = ? AND q.booking_id = ?
       FOR UPDATE`,
      [parsed.data.quoteId, bookingId]
    )
    const quote = rows[0]
    if (!quote) {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Quote not found.' },
        { status: 404 }
      )
    }
    if (quote.clientUID !== session.id) {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'This quote belongs to another client.' },
        { status: 403 }
      )
    }
    if (quote.quoteStatus !== 'pending' || quote.bookingStatus !== 'Pending') {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'This quote has already been handled.' },
        { status: 409 }
      )
    }

    artisanUid = quote.artisanUid
    amount = Number(quote.quoteAmount)

    if (parsed.data.action === 'reject') {
      await conn.execute(
        `UPDATE booking_quotes
         SET status = 'rejected', rejection_reason = ?, rejection_note = ?,
             responded_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [parsed.data.rejectionReason ?? null, parsed.data.rejectionNote ?? null, quote.quoteId]
      )
      await conn.execute(
        `UPDATE bookings SET clientDecision = 'Quote rejected' WHERE bookingId = ?`,
        [bookingId]
      )
    } else {
      await conn.execute(
        `UPDATE booking_quotes
         SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [quote.quoteId]
      )
      await conn.execute(
        `UPDATE booking_quotes
         SET status = 'superseded', updated_at = NOW()
         WHERE booking_id = ? AND id <> ? AND status = 'pending'`,
        [bookingId, quote.quoteId]
      )
      await conn.execute(
        `UPDATE bookings
         SET amountAgreed = ?, priceConfirmed = 1, bookingStatus = 'Awaiting Payment',
             clientDecision = 'Quote accepted', vendorDecision = 'Quoted'
         WHERE bookingId = ?`,
        [amount, bookingId]
      )
    }

    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => {})
    console.error('[BOOKING QUOTE RESPONSE]', error)
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'We could not update this quote. Please try again.',
      },
      { status: 500 }
    )
  } finally {
    conn.release()
  }

  const accepted = parsed.data.action === 'accept'
  const notificationBody = accepted
    ? `Your ₦${amount.toLocaleString()} quote for booking #${bookingId} was accepted. The client is completing payment.`
    : `The client requested changes to your quote for booking #${bookingId}: ${parsed.data.rejectionNote}`
  await Promise.allSettled([
    createDbNotification(artisanUid, notificationBody),
    sendPushNotification(
      artisanUid,
      accepted ? 'Quote Accepted' : 'Quote Changes Requested',
      notificationBody,
      { type: 'booking', bookingId: String(bookingId) }
    ),
  ])

  return NextResponse.json<ApiResponse<unknown>>(
    {
      success: true,
      data: {
        bookingId,
        quoteId: parsed.data.quoteId,
        quoteStatus: accepted ? 'accepted' : 'rejected',
        bookingStatus: accepted ? 'awaiting_payment' : 'pending',
      },
      message: accepted
        ? 'Quote accepted. Choose a payment method to confirm the booking.'
        : 'Changes requested. The artisan can now revise the quote.',
    },
    { status: 200 }
  )
}
