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
  confirmExternalPayment,
  createJobFundingInTransaction,
  createJobPaymentRetryInTransaction,
  createWalletFundedJobInTransaction,
  initializeJobPayWithTransfer,
  isMarketplaceFinanceEnabled,
  type JobFundingInitialization,
} from '@/lib/financial/marketplace-service'
import { majorToMinor } from '@/lib/financial/money-value'
import { FinancialError } from '@/lib/financial/errors'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

type PaymentBookingRow = RowDataPacket & {
  bookingId: number
  clientUID: string
  bookingStatus: string
  amountAgreed: number | string
  artisanUid: string
  clientEmail: string
}

type AcceptedQuoteRow = RowDataPacket & {
  id: number
  amount: number | string
}

type BookingPaymentAccountRow = RowDataPacket & {
  provider_reference: string
  status: string
  booking_status: string
  refund_status: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const rateLimit = checkRateLimit(`booking-payment-check:${session.id}`, 12, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Please wait a moment before checking again.' },
      { status: 429 }
    )
  }

  const { id } = await params
  const bookingId = Number.parseInt(id, 10)
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Booking not found.' },
      { status: 404 }
    )
  }
  if (!isMarketplaceFinanceEnabled()) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Bank transfer verification is temporarily unavailable.' },
      { status: 503 }
    )
  }

  const conn = await getConnection()
  let account: BookingPaymentAccountRow | null = null
  try {
    const [rows] = await conn.execute<BookingPaymentAccountRow[]>(
      `SELECT bpa.provider_reference, bpa.status,
              b.bookingStatus AS booking_status, b.refundStatus AS refund_status
       FROM booking_payment_accounts bpa
       JOIN bookings b ON b.bookingId = bpa.booking_id
       WHERE bpa.booking_id = ? AND b.clientUID = ?
       ORDER BY bpa.id DESC LIMIT 1`,
      [bookingId, session.id]
    )
    account = rows[0] ?? null
  } finally {
    conn.release()
  }

  if (!account) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'No bank-transfer payment was found for this booking.' },
      { status: 404 }
    )
  }
  if (account.booking_status === 'Cancelled') {
    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: true,
        data: { bookingId, status: 'cancelled', refundStatus: account.refund_status },
        message: account.refund_status === 'pending' || account.refund_status === 'processing'
          ? 'This booking was cancelled and the payment refund is being processed.'
          : 'This booking was cancelled.',
      },
      { status: 202 }
    )
  }
  if (account.status === 'paid') {
    return NextResponse.json<ApiResponse<unknown>>({
      success: true,
      data: { bookingId, status: 'confirmed' },
      message: 'Payment is verified.',
    })
  }
  if (account.status !== 'active') {
    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: true,
        data: { bookingId, status: account.status },
        message: account.status === 'rejected'
          ? 'The transfer was not accepted. Please generate a new account and transfer the exact amount.'
          : 'This transfer account is no longer active.',
      },
      { status: 202 }
    )
  }

  try {
    await confirmExternalPayment(account.provider_reference, {
      type: 'user',
      id: session.id,
    })
    return NextResponse.json<ApiResponse<unknown>>({
      success: true,
      data: { bookingId, status: 'confirmed' },
      message: 'Payment is verified.',
    })
  } catch (error) {
    if (error instanceof FinancialError && error.code === 'INVALID_STATE') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: true,
          data: { bookingId, status: 'pending' },
          message: 'We are still waiting for the bank to verify this transfer.',
        },
        { status: 202 }
      )
    }
    console.error('[BOOKING PAYMENT CHECK]', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'We could not verify this transfer yet. Please try again shortly.' },
      { status: 502 }
    )
  }
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
  if (session.role === 'artisan') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only the client can pay for this booking.' },
      { status: 403 }
    )
  }

  const rateLimit = checkRateLimit(`booking-payment:${session.id}`, 8, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: `Too many payment attempts. Try again in ${rateLimit.retryAfter} seconds.` },
      { status: 429 }
    )
  }

  const { id } = await params
  const bookingId = Number.parseInt(id, 10)
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Booking not found.' },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = null
  }
  const parsed = z.object({
    method: z.enum(['wallet', 'bank_transfer']),
  }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Choose wallet credit or bank transfer.' },
      { status: 400 }
    )
  }

  const conn = await getConnection()
  let booking: PaymentBookingRow | null = null
  let quote: AcceptedQuoteRow | null = null
  let initialization: JobFundingInitialization | null = null
  try {
    await conn.beginTransaction()
    const [bookingRows] = await conn.execute<PaymentBookingRow[]>(
      `SELECT b.bookingId, b.clientUID, b.bookingStatus, b.amountAgreed,
              bus.uid AS artisanUid, u.email AS clientEmail
       FROM bookings b
       JOIN businesses bus ON bus.businessId = b.businessId
       JOIN users u ON u.uid = b.clientUID
       WHERE b.bookingId = ?
       FOR UPDATE`,
      [bookingId]
    )
    booking = bookingRows[0] ?? null
    if (!booking) {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Booking not found.' },
        { status: 404 }
      )
    }
    if (booking.clientUID !== session.id) {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'This booking belongs to another client.' },
        { status: 403 }
      )
    }
    if (booking.bookingStatus === 'Confirmed') {
      await conn.commit()
      return NextResponse.json<ApiResponse<unknown>>({
        success: true,
        data: { bookingId, status: 'confirmed' },
        message: 'Payment is already secured for this booking.',
      })
    }
    if (booking.bookingStatus !== 'Awaiting Payment') {
      await conn.rollback()
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Accept an artisan quote before making payment.' },
        { status: 409 }
      )
    }

    const [quoteRows] = await conn.execute<AcceptedQuoteRow[]>(
      `SELECT id, amount FROM booking_quotes
       WHERE booking_id = ? AND status = 'accepted'
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [bookingId]
    )
    quote = quoteRows[0] ?? null
    if (!quote || Number(quote.amount) !== Number(booking.amountAgreed)) {
      throw new FinancialError('INVALID_STATE', 'The accepted quote does not match this booking.', 409)
    }

    if (parsed.data.method === 'wallet') {
      const useMarketplaceFinance = isMarketplaceFinanceEnabled()
      const useMoneyV2 = !useMarketplaceFinance && isMoneyV2Enabled()

      if (useMarketplaceFinance) {
        const [existingFunds] = await conn.execute<RowDataPacket[]>(
          `SELECT id FROM job_funds WHERE booking_id = ? FOR UPDATE`,
          [bookingId]
        )
        if (existingFunds[0]) {
          throw new FinancialError(
            'INVALID_STATE',
            'A bank-transfer payment has already been created for this booking. Complete it or generate a new account.',
            409
          )
        }
        await createWalletFundedJobInTransaction(conn, {
          bookingId,
          clientUid: session.id,
          artisanUid: booking.artisanUid,
          amountMinor: majorToMinor(String(quote.amount)),
          actor: { type: 'user', id: session.id },
        })
      } else if (useMoneyV2) {
        await holdBookingFunds(conn, {
          bookingId,
          clientUid: session.id,
          artisanUid: booking.artisanUid,
          amountKobo: nairaToKobo(Number(quote.amount)),
        })
      } else {
        await holdLegacyBookingFunds(conn, {
          bookingId,
          clientUid: session.id,
          artisanUid: booking.artisanUid,
          amount: Number(quote.amount),
        })
      }

      await conn.execute(
        `UPDATE bookings SET bookingStatus = 'Confirmed' WHERE bookingId = ?`,
        [bookingId]
      )
      await conn.commit()
    } else {
      if (!isMarketplaceFinanceEnabled()) {
        throw new FinancialError(
          'CONFIGURATION_ERROR',
          'Bank transfer is temporarily unavailable. You can use available wallet credit instead.',
          503
        )
      }

      const [activeAccounts] = await conn.execute<(RowDataPacket & {
        provider_reference: string
        amount_kobo: string | number
        bank_name: string
        bank_slug: string
        account_name: string
        account_number: string
        expires_at: Date
      })[]>(
        `SELECT provider_reference, amount_kobo, bank_name, bank_slug,
                account_name, account_number, expires_at
         FROM booking_payment_accounts
         WHERE booking_id = ? AND status = 'active' AND expires_at > NOW()
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [bookingId]
      )
      const active = activeAccounts[0]
      if (active) {
        await conn.commit()
        return NextResponse.json<ApiResponse<unknown>>({
          success: true,
          data: {
            method: 'bank_transfer',
            reference: active.provider_reference,
            amount: Number(active.amount_kobo) / 100,
            bankName: active.bank_name,
            bankSlug: active.bank_slug,
            accountName: active.account_name,
            accountNumber: active.account_number,
            expiresAt: active.expires_at,
          },
          message: 'Use these account details to complete payment.',
        })
      }

      await conn.execute(
        `UPDATE booking_payment_accounts
         SET status = 'expired', updated_at = NOW()
         WHERE booking_id = ? AND status = 'active' AND expires_at <= NOW()`,
        [bookingId]
      )
      const [existingFunds] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM job_funds WHERE booking_id = ? FOR UPDATE`,
        [bookingId]
      )
      initialization = existingFunds[0]
        ? await createJobPaymentRetryInTransaction(conn, {
            bookingId,
            clientUid: session.id,
            customerEmail: booking.clientEmail,
            actor: { type: 'user', id: session.id },
          })
        : await createJobFundingInTransaction(conn, {
            bookingId,
            clientUid: session.id,
            artisanUid: booking.artisanUid,
            customerEmail: booking.clientEmail,
            amountMinor: majorToMinor(String(quote.amount)),
            actor: { type: 'user', id: session.id },
          })
      await conn.commit()
    }
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    console.error('[BOOKING PAYMENT]', error)
    const insufficient =
      (error instanceof FinancialError && error.code === 'INSUFFICIENT_FUNDS') ||
      (error instanceof Error && /insufficient/i.test(error.message))
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: insufficient
          ? 'Your available credit is too low. Fund your wallet or pay by bank transfer.'
          : error instanceof FinancialError
            ? error.message
            : 'We could not start this payment. Please try again.',
      },
      { status: insufficient ? 402 : error instanceof FinancialError ? error.httpStatus : 500 }
    )
  } finally {
    conn.release()
  }

  if (parsed.data.method === 'bank_transfer') {
    if (!booking || !quote || !initialization) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'We could not prepare this payment. Please try again.' },
        { status: 500 }
      )
    }
    try {
      const payment = await initializeJobPayWithTransfer({
        ...initialization,
        quoteId: quote.id,
        customerEmail: booking.clientEmail,
        clientUid: session.id,
        bookingId,
      })
      return NextResponse.json<ApiResponse<unknown>>({
        success: true,
        data: {
          method: 'bank_transfer',
          reference: payment.reference,
          amount: payment.amountMinor / 100,
          bankName: payment.bankName,
          bankSlug: payment.bankSlug,
          accountName: payment.accountName,
          accountNumber: payment.accountNumber,
          expiresAt: payment.expiresAt,
        },
        message: 'Transfer the exact amount to this temporary account.',
      })
    } catch (error) {
      console.error('[BOOKING PWT INITIALIZATION]', error)
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: error instanceof FinancialError
            ? error.message
            : 'Paystack could not generate a transfer account. Please try again.',
        },
        { status: error instanceof FinancialError ? error.httpStatus : 502 }
      )
    }
  }

  if (booking) {
    const body = `Payment is secured for booking #${bookingId}. You can now proceed with the client.`
    await Promise.allSettled([
      createDbNotification(booking.artisanUid, body),
      sendPushNotification(booking.artisanUid, 'Booking Confirmed', body, {
        type: 'booking',
        bookingId: String(bookingId),
      }),
    ])
  }

  return NextResponse.json<ApiResponse<unknown>>({
    success: true,
    data: { method: 'wallet', bookingId, status: 'confirmed' },
    message: 'Payment secured. The booking is confirmed.',
  })
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
     FROM wallet_ledger WHERE wallet_id = ?`,
    [clientWalletId]
  )
  const balance = Number(balanceRows[0]?.balance ?? 0)
  if (balance < input.amount) {
    throw new FinancialError('INSUFFICIENT_FUNDS', 'Available credit is insufficient', 402)
  }
  await conn.execute(
    `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
     VALUES (?, ?, 'debit', ?, ?, NOW())`,
    [clientWalletId, input.amount, balance - input.amount, `Payment secured for booking #${input.bookingId}`]
  )
  await conn.execute(
    `INSERT INTO wallet_escrow (
       booking_id, client_wallet_id, vendor_wallet_id, escrow_wallet_id, amount, status, created_at
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
