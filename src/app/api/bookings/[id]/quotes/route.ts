import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getVerifiedSession } from '@/lib/auth'
import { getConnection } from '@/lib/db'
import { checkRateLimit } from '@/lib/wallet'
import { createDbNotification } from '@/lib/queries'
import { sendPushNotification } from '@/lib/notifications'
import { holdBookingFunds, isMoneyV2Enabled, nairaToKobo } from '@/lib/money'
import {
  createWalletFundedJobInTransaction,
  isMarketplaceFinanceEnabled,
} from '@/lib/financial/marketplace-service'
import { majorToMinor } from '@/lib/financial/money-value'
import { FinancialError } from '@/lib/financial/errors'
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
      `UPDATE bookings SET vendorDecision = 'Quoted' WHERE bookingId = ?`,
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
  }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Please choose whether to accept or reject this quote.' },
      { status: 400 }
    )
  }

  const conn = await getConnection()
  let artisanUid = ''
  let amount = 0
  let fundingReference: string | null = null
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
         SET status = 'rejected', responded_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [quote.quoteId]
      )
      await conn.execute(
        `UPDATE bookings SET clientDecision = 'Quote rejected' WHERE bookingId = ?`,
        [bookingId]
      )
    } else {
      const useMarketplaceFinance = isMarketplaceFinanceEnabled()
      const useMoneyV2 = !useMarketplaceFinance && isMoneyV2Enabled()

      if (useMarketplaceFinance) {
        const funded = await createWalletFundedJobInTransaction(conn, {
          bookingId,
          clientUid: session.id,
          artisanUid,
          amountMinor: majorToMinor(String(amount)),
          actor: { type: 'user', id: session.id },
        })
        fundingReference = funded.reference
      } else if (useMoneyV2) {
        await holdBookingFunds(conn, {
          bookingId,
          clientUid: session.id,
          artisanUid,
          amountKobo: nairaToKobo(amount),
        })
      } else {
        await holdLegacyBookingFunds(conn, {
          bookingId,
          clientUid: session.id,
          artisanUid,
          amount,
        })
      }

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
         SET amountAgreed = ?, priceConfirmed = 1, bookingStatus = 'Confirmed',
             clientDecision = 'Quote accepted', vendorDecision = 'Quoted'
         WHERE bookingId = ?`,
        [amount, bookingId]
      )
    }

    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => {})
    console.error('[BOOKING QUOTE RESPONSE]', error)
    const insufficient =
      (error instanceof FinancialError && error.code === 'INSUFFICIENT_FUNDS') ||
      (error instanceof Error && /insufficient/i.test(error.message))
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: insufficient
          ? 'Your wallet balance is too low to accept this quote. Fund your wallet, then try again.'
          : error instanceof FinancialError
            ? error.message
            : 'We could not update this quote. Please try again.',
      },
      { status: insufficient ? 402 : error instanceof FinancialError ? error.httpStatus : 500 }
    )
  } finally {
    conn.release()
  }

  const accepted = parsed.data.action === 'accept'
  const notificationBody = accepted
    ? `Your ₦${amount.toLocaleString()} quote for booking #${bookingId} was accepted and funded.`
    : `Your quote for booking #${bookingId} was declined. You can review the request and send a revised quote.`
  await Promise.allSettled([
    createDbNotification(artisanUid, notificationBody),
    sendPushNotification(
      artisanUid,
      accepted ? 'Quote Accepted' : 'Quote Declined',
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
        bookingStatus: accepted ? 'confirmed' : 'pending',
        fundingReference,
      },
      message: accepted
        ? 'Quote accepted. Payment is secured and the booking is confirmed.'
        : 'Quote declined. The artisan can send you a revised quote.',
    },
    { status: 200 }
  )
}

async function holdLegacyBookingFunds(
  conn: PoolConnection,
  input: { bookingId: number; clientUid: string; artisanUid: string; amount: number }
) {
  const clientWalletId = await ensureLegacyWallet(conn, input.clientUid)
  const artisanWalletId = await ensureLegacyWallet(conn, input.artisanUid)

  await conn.execute<RowDataPacket[]>('SELECT id FROM wallets WHERE id = ? FOR UPDATE', [clientWalletId])
  const [balanceRows] = await conn.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS balance
     FROM wallet_ledger
     WHERE wallet_id = ?`,
    [clientWalletId]
  )
  const currentBalance = Number(balanceRows[0]?.balance ?? 0)
  if (currentBalance < input.amount) {
    throw new FinancialError('INSUFFICIENT_FUNDS', 'Available balance is insufficient', 402)
  }

  await conn.execute(
    `INSERT INTO wallet_ledger (
       wallet_id, amount, direction, balance_after, description, created_at
     ) VALUES (?, ?, 'debit', ?, ?, NOW())`,
    [
      clientWalletId,
      input.amount,
      currentBalance - input.amount,
      `Payment locked for booking #${input.bookingId}`,
    ]
  )
  await conn.execute(
    `INSERT INTO wallet_escrow (
       booking_id, client_wallet_id, vendor_wallet_id, escrow_wallet_id,
       amount, status, created_at
     ) VALUES (?, ?, ?, (SELECT id FROM wallets WHERE wallet_type = 'escrow' LIMIT 1), ?, 'held', NOW())`,
    [input.bookingId, clientWalletId, artisanWalletId, input.amount]
  )
}

async function ensureLegacyWallet(conn: PoolConnection, uid: string): Promise<number> {
  const [userRows] = await conn.execute<RowDataPacket[]>(
    'SELECT userId, email FROM users WHERE uid = ? LIMIT 1',
    [uid]
  )
  const user = userRows[0]
  if (!user) throw new FinancialError('ACCOUNT_NOT_FOUND', 'Wallet account not found', 404)

  const [walletRows] = await conn.execute<RowDataPacket[]>(
    `SELECT id FROM wallets WHERE user_id = ? AND wallet_type = 'user' LIMIT 1`,
    [user.userId]
  )
  if (walletRows[0]) return Number(walletRows[0].id)

  const [result] = await conn.execute<ResultSetHeader>(
    `INSERT INTO wallets (user_id, email, currency, wallet_type, status, created_at)
     VALUES (?, ?, 'NGN', 'user', 'active', NOW())`,
    [user.userId, user.email]
  )
  return result.insertId
}
