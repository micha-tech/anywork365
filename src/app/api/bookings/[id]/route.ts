import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'
import type { RowDataPacket } from 'mysql2'
import mysql from 'mysql2/promise'

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

  const { getConnection } = await import('@/lib/db')
  const conn = await getConnection()
  let connReleased = false

  try {
    // Lock the booking row and check status atomically
    const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT b.*, bus.uid AS businessUid FROM bookings b JOIN businesses bus ON bus.businessId = b.businessId WHERE b.bookingId = ? FOR UPDATE', [bookingId])
    const booking = rows[0]
    if (!booking) {
      connReleased = true; conn.release()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    const isClient = booking.clientUID === session.id
    const isVendor = booking.businessUid === session.id

    if (!isClient && !isVendor) {
      connReleased = true; conn.release()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Not authorized to update this booking' },
        { status: 403 }
      )
    }

    if (booking.bookingStatus === 'Closed' || booking.bookingStatus === 'Cancelled') {
      connReleased = true; conn.release()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Cannot update a completed or cancelled booking' },
        { status: 400 }
      )
    }

    const dbStatusMap: Record<string, string> = {
      confirm: 'Confirmed',
      complete: 'Closed',
      cancel: 'Cancelled',
    }
    const newStatus = dbStatusMap[action]

    if (action === 'confirm' && !isVendor) {
      connReleased = true; conn.release()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only the vendor can confirm a booking' },
        { status: 403 }
      )
    }

    if (action === 'complete' && !isClient) {
      connReleased = true; conn.release()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only the client can mark a booking as complete' },
        { status: 403 }
      )
    }

    if (action === 'cancel' && booking.bookingStatus !== 'Pending') {
      connReleased = true; conn.release()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only pending bookings can be cancelled' },
        { status: 400 }
      )
    }

    await conn.execute('START TRANSACTION')

    if (action === 'complete') {
      const [vendorRows] = await conn.query<mysql.RowDataPacket[]>('SELECT userId FROM users WHERE uid = ?', [booking.businessUid])
      const [clientRows] = await conn.query<mysql.RowDataPacket[]>('SELECT userId FROM users WHERE uid = ?', [session.id])
      if (clientRows.length === 0) {
        await conn.execute('ROLLBACK')
        connReleased = true; conn.release()
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }

      const [clientWalletRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM wallets WHERE user_id = ?', [clientRows[0].userId])
      if (clientWalletRows.length === 0) {
        await conn.execute('ROLLBACK')
        connReleased = true; conn.release()
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Client wallet not found' },
          { status: 400 }
        )
      }

      const amount = booking.amountAgreed
      const PLATFORM_FEE_PERCENT = 5
      const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT / 100)
      const proAmount = amount - platformFee

      if (vendorRows.length > 0) {
        const [vWalletRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM wallets WHERE user_id = ?', [vendorRows[0].userId])
        if (vWalletRows.length > 0) {
          const [vBalRows] = await conn.query<mysql.RowDataPacket[]>('SELECT balance_after FROM wallet_ledger WHERE wallet_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE', [vWalletRows[0].id])
          const vBal = vBalRows.length > 0 ? vBalRows[0].balance_after : 0
          await conn.execute('INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [vWalletRows[0].id, proAmount, 'credit', vBal + proAmount, `Job earnings - booking #${bookingId}`])
        }
      }

      const [escWalletRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM wallets WHERE wallet_type = ? LIMIT 1', ['escrow'])
      if (escWalletRows.length > 0) {
        const [eBalRows] = await conn.query<mysql.RowDataPacket[]>('SELECT balance_after FROM wallet_ledger WHERE wallet_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE', [escWalletRows[0].id])
        const eBal = eBalRows.length > 0 ? eBalRows[0].balance_after : 0
        await conn.execute('INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [escWalletRows[0].id, platformFee, 'credit', eBal + platformFee, `Platform fee - booking #${bookingId}`])
      }

      await conn.execute("UPDATE wallet_escrow SET status = 'released', released_at = NOW() WHERE booking_id = ?", [bookingId])
    }

    if (action === 'cancel') {
      const [clientRows] = await conn.query<mysql.RowDataPacket[]>('SELECT userId FROM users WHERE uid = ?', [booking.clientUID])
      if (clientRows.length > 0) {
        const [walletRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM wallets WHERE user_id = ?', [clientRows[0].userId])
        if (walletRows.length > 0) {
          const [balRows] = await conn.query<mysql.RowDataPacket[]>('SELECT balance_after FROM wallet_ledger WHERE wallet_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE', [walletRows[0].id])
          const balance = balRows.length > 0 ? balRows[0].balance_after : 0
          await conn.execute('INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [walletRows[0].id, booking.amountAgreed, 'credit', balance + booking.amountAgreed, `Escrow refunded for cancelled booking #${bookingId}`])
          await conn.execute("UPDATE wallet_escrow SET status = 'refunded', released_at = NOW() WHERE booking_id = ?", [bookingId])
        }
      }
    }

    await conn.execute(
      'UPDATE bookings SET bookingStatus = ?, vendorDecision = ?, clientDecision = ? WHERE bookingId = ?',
      [
        newStatus,
        isVendor ? 'Accepted' : booking.vendorDecision || '',
        isClient ? 'Accepted' : booking.clientDecision || '',
        bookingId,
      ]
    )

    await conn.execute('COMMIT')
    connReleased = true; conn.release()

    // Non-critical: push notifications outside transaction
    try {
      const { sendPushNotification } = await import('@/lib/notifications')
      if (action === 'confirm') {
        await sendPushNotification(booking.clientUID, 'Booking Confirmed', `Your booking #${bookingId} has been confirmed by the vendor.`)
      } else if (action === 'complete') {
        await sendPushNotification(booking.businessUid, 'Job Completed', `Booking #${bookingId} has been marked as complete. Payment released.`)
      }
    } catch {
      // Non-critical
    }

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
  } catch (err) {
    if (!connReleased) {
      await conn.execute('ROLLBACK').catch(() => {})
      conn.release()
      connReleased = true
    }
    console.error('[BOOKING PATCH]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to update booking' },
      { status: 500 }
    )
  } finally {
    if (!connReleased) {
      conn.release()
    }
  }
}
