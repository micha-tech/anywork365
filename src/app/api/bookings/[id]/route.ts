import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getBookingById,
  getUserRowByUid,
  getWalletByUserId,
  getWalletBalance,
  addLedgerEntry,
} from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'
import type { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const rateLimit = checkRateLimit(`bookings-patch:${session.id}`, 10, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.` },
      { status: 429 }
    )
  }

  const { id } = await params
  const bookingId = parseInt(id, 10)
  if (isNaN(bookingId)) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Invalid booking ID' },
      { status: 400 }
    )
  }

  const { action } = await req.json()
  if (!['confirm', 'complete', 'cancel'].includes(action)) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Invalid action. Must be confirm, complete, or cancel' },
      { status: 400 }
    )
  }

  const booking = await getBookingById(bookingId)
  if (!booking) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Booking not found' },
      { status: 404 }
    )
  }

  const business = await getBusinessByIdFallback(booking.businessId)
  if (!business) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Business not found' },
      { status: 404 }
    )
  }

  const isClient = booking.clientUID === session.id
  const isVendor = business.uid === session.id

  if (!isClient && !isVendor) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Not authorized to update this booking' },
      { status: 403 }
    )
  }

  if (booking.bookingStatus === 'Closed' || booking.bookingStatus === 'Cancelled') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Cannot update a completed or cancelled booking' },
      { status: 400 }
    )
  }

  const { execute } = await import('@/lib/db')

  const dbStatusMap: Record<string, string> = {
    confirm: 'Confirmed',
    complete: 'Closed',
    cancel: 'Cancelled',
  }
  const newStatus = dbStatusMap[action]

  if (action === 'confirm' && !isVendor) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only the vendor can confirm a booking' },
      { status: 403 }
    )
  }

  if (action === 'complete' && !isClient) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only the client can mark a booking as complete' },
      { status: 403 }
    )
  }

  if (action === 'cancel' && booking.bookingStatus !== 'Pending') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only pending bookings can be cancelled' },
      { status: 400 }
    )
  }

  if (action === 'complete') {
    const vendorRow = await getUserRowByUid(business.uid)
    const clientRow = await getUserRowByUid(session.id)
    if (!clientRow) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const clientWallet = await getWalletByUserId(clientRow.userId)
    if (!clientWallet) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Client wallet not found' },
        { status: 400 }
      )
    }

    let vendorWallet = null
    if (vendorRow) {
      vendorWallet = await getWalletByUserId(vendorRow.userId)
    }

    const amount = booking.amountAgreed
    const PLATFORM_FEE_PERCENT = 5
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT / 100)
    const proAmount = amount - platformFee

    const clientBalance = await getWalletBalance(clientWallet.id)
    await addLedgerEntry({
      wallet_id: clientWallet.id,
      amount,
      direction: 'credit',
      balance_after: clientBalance + amount,
      description: `Escrow released for booking #${bookingId}`,
    })

    if (vendorWallet) {
      const vendorBalance = await getWalletBalance(vendorWallet.id)
      await addLedgerEntry({
        wallet_id: vendorWallet.id,
        amount: proAmount,
        direction: 'credit',
        balance_after: vendorBalance + proAmount,
        description: `Job earnings - booking #${bookingId}`,
      })
    }

    await execute(
      'UPDATE wallet_escrow SET status = ?, released_at = NOW() WHERE booking_id = ?',
      ['released', bookingId]
    )
  }

  if (action === 'cancel') {
    const clientRow = await getUserRowByUid(booking.clientUID)
    if (clientRow) {
      const wallet = await getWalletByUserId(clientRow.userId)
      if (wallet) {
        const balance = await getWalletBalance(wallet.id)
        await addLedgerEntry({
          wallet_id: wallet.id,
          amount: booking.amountAgreed,
          direction: 'credit',
          balance_after: balance + booking.amountAgreed,
          description: `Escrow refunded for cancelled booking #${bookingId}`,
        })

        await execute(
          'UPDATE wallet_escrow SET status = ?, released_at = NOW() WHERE booking_id = ?',
          ['refunded', bookingId]
        )
      }
    }
  }

  await execute(
    'UPDATE bookings SET bookingStatus = ?, vendorDecision = ?, clientDecision = ? WHERE bookingId = ?',
    [
      newStatus,
      isVendor ? 'Accepted' : booking.vendorDecision || '',
      isClient ? 'Accepted' : booking.clientDecision || '',
      bookingId,
    ]
  )

  return NextResponse.json<ApiResponse<any>>(
    {
      success: true,
      data: { id: bookingId, status: action === 'complete' ? 'completed' : action === 'cancel' ? 'cancelled' : 'confirmed' },
      message:
        action === 'confirm' ? 'Booking confirmed!' :
        action === 'complete' ? 'Job marked as complete. Payment released to vendor.' :
        'Booking cancelled.',
    },
    { status: 200 }
  )
}

async function getBusinessByIdFallback(id: number) {
  const { queryOne } = await import('@/lib/db')
  interface BusRow extends RowDataPacket {
    businessId: number
    uid: string
    businessName: string
  }
  return queryOne<BusRow[]>('SELECT * FROM businesses WHERE businessId = ? AND deleted = 0', [id])
}
