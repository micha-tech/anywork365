import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getBookingById } from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'
import type { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const rateLimit = checkRateLimit(`reviews:${session.id}`, 5, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.` },
      { status: 429 }
    )
  }

  const { bookingId, rating, comment } = await req.json()

  if (!bookingId || !rating || !comment?.trim()) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Missing required fields: bookingId, rating, comment' },
      { status: 400 }
    )
  }

  const numRating = Number(rating)
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Rating must be an integer between 1 and 5' },
      { status: 400 }
    )
  }

  const booking = await getBookingById(Number(bookingId))
  if (!booking) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Booking not found' },
      { status: 404 }
    )
  }

  if (booking.clientUID !== session.id) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only the client who made this booking can leave a review' },
      { status: 403 }
    )
  }

  if (booking.bookingStatus !== 'Closed') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'You can only review completed bookings' },
      { status: 400 }
    )
  }

  interface AvgRow extends RowDataPacket { avg: number | null; cnt: number }
  const { getConnection } = await import('@/lib/db')
  const connection = await getConnection()
  try {
    await connection.execute('START TRANSACTION')

    interface ReviewIdRow extends RowDataPacket { reviewId: number }
    const [existing] = await connection.query<ReviewIdRow[]>(
      'SELECT reviewId FROM reviews WHERE businessId = ? AND userUid = ? LIMIT 1',
      [booking.businessId, session.id]
    )
    if ((existing as ReviewIdRow[]).length > 0) {
      await connection.execute('ROLLBACK')
      connection.release()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'You have already reviewed this vendor for this booking' },
        { status: 409 }
      )
    }

    await connection.execute(
      `INSERT INTO reviews (businessId, userUid, review, dateAdded) VALUES (?, ?, ?, NOW())`,
      [booking.businessId, session.id, comment.trim()]
    )

    await connection.execute(
      `INSERT INTO business_ratings (userUid, businessId, rating) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = ?`,
      [session.id, booking.businessId, numRating, numRating]
    )

    const [avgRows] = await connection.query<AvgRow[]>(
      'SELECT AVG(rating) AS avg, COUNT(*) AS cnt FROM business_ratings WHERE businessId = ?',
      [booking.businessId]
    )
    const avg = (avgRows as AvgRow[])[0]?.avg ?? 0
    const cnt = (avgRows as AvgRow[])[0]?.cnt ?? 0

    await connection.execute(
      'UPDATE businesses SET rating = ?, reviews = ? WHERE businessId = ?',
      [Math.round(avg * 10) / 10, cnt, booking.businessId]
    )

    await connection.execute('COMMIT')
    connection.release()
  } catch (txErr) {
    await connection.execute('ROLLBACK')
    connection.release()
    throw txErr
  }

  return NextResponse.json<ApiResponse<any>>(
    {
      success: true,
      data: { businessId: booking.businessId, rating: numRating, comment: comment.trim() },
      message: 'Review submitted successfully!',
    },
    { status: 201 }
  )
}
