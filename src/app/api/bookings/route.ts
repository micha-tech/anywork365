import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import {
  getBookingsByClient,
  getBookingsByBusiness,
  getBusinessByUid,
  getUserRowByUid,
  getWalletByUserId,
  getOrCreateWallet as getOrCreateWalletDb,
  createDbNotification,
} from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import { sendPushNotification } from '@/lib/notifications'
import { getConnection } from '@/lib/db'
import type { ApiResponse } from '@/types'
import type mysql from 'mysql2'
import type { RowDataPacket } from 'mysql2'
import { holdBookingFunds, isMoneyV2Enabled, nairaToKobo } from '@/lib/money'
import {
  createJobFundingInTransaction,
  initializeJobPayment,
  isMarketplaceFinanceEnabled,
  type JobFundingInitialization,
} from '@/lib/financial/marketplace-service'
import { majorToMinor } from '@/lib/financial/money-value'

export const runtime = 'nodejs'

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

  let bookings: any[] = []

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

  const body = await req.json()
  const schema = z.object({
    vendorId: z.string().min(1, 'Artisan is required'),
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

  const useMarketplaceFinance = isMarketplaceFinanceEnabled()
  const useMoneyV2 = !useMarketplaceFinance && isMoneyV2Enabled()
  let clientWallet = await getWalletByUserId(clientRow.userId)
  let vendorWalletId: number | null = null
  if (!useMarketplaceFinance && !useMoneyV2) {
    // Legacy wallets are only touched while the v2 ledger rollout flag is off.
    clientWallet = clientWallet ?? await getOrCreateWalletDb(clientRow.userId, clientRow.email)
    const vendorRow = await getUserRowByUid(vendorId)
    if (vendorRow) {
      let vw = await getWalletByUserId(vendorRow.userId)
      if (!vw) {
        vw = await getOrCreateWalletDb(vendorRow.userId, vendorRow.email)
      }
      vendorWalletId = vw.id
    }
  }

  // Transaction: atomic booking and legacy locked-funds handling.
  const conn = await getConnection()
  let fundingInitialization: JobFundingInitialization | null = null
  try {
    await conn.beginTransaction()

    let currentBalance = 0
    if (!useMarketplaceFinance && !useMoneyV2) {
      if (!clientWallet) throw new Error('Client wallet not found')
      // Lock the legacy wallet row while legacy mode remains active.
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

      const [balRows] = await conn.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS balance
         FROM wallet_ledger WHERE wallet_id = ?`,
        [clientWallet.id]
      )
      currentBalance = Number(balRows[0]?.balance ?? 0)
      if (currentBalance < budget) {
        await conn.rollback()
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Insufficient balance. Please fund your wallet and try again.' },
          { status: 400 }
        )
      }
    }

    // INSERT booking
    const [bookingResult] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO bookings (businessId, clientUID, bookedDate, bookedTime, appointmentAddress, meetingPoint, additionalInfo, bookingStatus, amountAgreed, priceConfirmed, dateBooked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        vendor.businessId,
        session.id,
        date,
        new Date().toLocaleTimeString('en-US', { hour12: false }),
        location || '',
        location || '',
        description,
        useMarketplaceFinance ? 'Awaiting Payment' : 'Pending',
        budget,
      ]
    )
    const bookingId = bookingResult.insertId

    if (useMarketplaceFinance) {
      fundingInitialization = await createJobFundingInTransaction(conn, {
        bookingId,
        clientUid: session.id,
        artisanUid: vendorId,
        customerEmail: session.email,
        amountMinor: majorToMinor(String(budget)),
        actor: { type: 'user', id: session.id },
      })
    } else if (useMoneyV2) {
      await holdBookingFunds(conn, {
        bookingId,
        clientUid: session.id,
        artisanUid: vendorId,
        amountKobo: nairaToKobo(budget),
      })
    } else {
      if (!clientWallet) throw new Error('Client wallet not found')
      const newBalance = currentBalance - budget
      await conn.execute(
        `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
         VALUES (?, ?, 'debit', ?, ?, NOW())`,
        [clientWallet.id, budget, newBalance, `Payment locked for booking #${bookingId}`]
      )

      if (!vendorWalletId) throw new Error('Artisan wallet not found')
      await conn.execute(
        `INSERT INTO wallet_escrow (booking_id, client_wallet_id, vendor_wallet_id, escrow_wallet_id, amount, status, created_at)
         VALUES (?, ?, ?, (SELECT id FROM wallets WHERE wallet_type = 'escrow' LIMIT 1), ?, 'held', NOW())`,
        [bookingId, clientWallet.id, vendorWalletId, budget]
      )
    }

    await conn.commit()

    if (useMarketplaceFinance && fundingInitialization) {
      try {
        const payment = await initializeJobPayment({
          ...fundingInitialization,
          customerEmail: session.email,
          clientUid: session.id,
          bookingId,
          callbackUrl: `${req.nextUrl.origin}/api/wallet/verify?ref=${fundingInitialization.reference}`,
        })
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
              status: 'awaiting_payment',
              paymentReference: payment.reference,
              authorizationUrl: payment.authorizationUrl,
              createdAt: new Date().toISOString(),
            },
            message: 'Booking created. Complete payment to send it to the artisan.',
          },
          { status: 201 }
        )
      } catch (error) {
        console.error('[BOOKING PAYMENT INITIALIZATION]', error)
        return NextResponse.json<ApiResponse<any>>(
          {
            success: false,
            error: 'Booking was saved, but payment could not be started. Retry payment from the booking.',
            data: { id: bookingId, paymentReference: fundingInitialization.reference },
          },
          { status: 502 }
        )
      }
    }

    const clientName = clientRow.fullName || 'A client'
    const notificationBody = `${clientName} sent booking #${bookingId} for ₦${budget.toLocaleString()}.`
    await Promise.allSettled([
      createDbNotification(vendorId, notificationBody),
      sendPushNotification(
        vendorId,
        'New Booking Request',
        notificationBody,
        { type: 'booking', bookingId: String(bookingId) }
      ),
    ])

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
        message: 'Booking request sent! The artisan will respond shortly.',
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
