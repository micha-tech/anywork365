import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { requireSupportApi, unauthorized } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'

type AnyRow = RowDataPacket & Record<string, unknown>

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    await requireSupportApi()
    const { uid } = await params

    const user = await queryOne<AnyRow[]>(
      `SELECT
         u.uid, u.email, u.fullName, u.phoneNumber, u.state, u.lga, u.address, u.bio,
         u.profileImage, u.verified, u.dateJoined,
         COALESCE(u.role, CASE WHEN u.hasBusinessAccount = 1 THEN 'artisan' ELSE 'client' END) AS role,
         b.businessName, b.category AS businessCategory, b.businessContact,
         b.description AS businessDescription, b.location AS businessLocation,
         pp.industry_category AS industryCategory,
         pp.professional_service_category AS professionalServiceCategory,
         pp.job_title AS jobTitle, pp.qualification, pp.years_experience AS yearsExperience,
         rp.company_name AS companyName, rp.company_size AS companySize,
         rp.industry_category AS recruiterIndustry, rp.recruitment_function AS recruitmentFunction,
         rp.position
       FROM users u
       LEFT JOIN businesses b
         ON b.businessId = (
           SELECT MAX(b2.businessId)
           FROM businesses b2
           WHERE BINARY b2.uid = BINARY u.uid AND b2.deleted = 0
         )
       LEFT JOIN professional_profiles pp ON BINARY pp.uid = BINARY u.uid
       LEFT JOIN recruiter_profiles rp ON BINARY rp.uid = BINARY u.uid
       WHERE u.uid = ? AND u.deleted = 0`,
      [uid]
    )

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const wallet = await queryOne<AnyRow[]>(
      `SELECT w.id AS walletId, w.email AS walletEmail, w.currency,
              w.status AS walletStatus,
              COALESCE(SUM(CASE WHEN wl.direction = 'credit' THEN wl.amount ELSE -wl.amount END), 0) AS balance,
              COUNT(wl.id) AS transactionCount
       FROM wallets w
       LEFT JOIN wallet_ledger wl ON wl.wallet_id = w.id
       WHERE w.user_id = (SELECT userId FROM users WHERE uid = ?)
       GROUP BY w.id
       ORDER BY w.id DESC
       LIMIT 1`,
      [uid]
    )

    const [transactions, bookings] = await Promise.all([
      query<AnyRow[]>(
        `SELECT wl.id, wl.amount, wl.direction, wl.balance_after AS balanceAfter,
                wl.description, wl.created_at AS createdAt,
                wt.reference, wt.type, wt.status
         FROM wallet_ledger wl
         LEFT JOIN wallet_transactions wt ON wt.id = wl.transaction_id
         WHERE wl.wallet_id = (
           SELECT id FROM wallets
           WHERE user_id = (SELECT userId FROM users WHERE uid = ?)
           ORDER BY id DESC LIMIT 1
         )
         ORDER BY wl.created_at DESC
         LIMIT 30`,
        [uid]
      ),
      query<AnyRow[]>(
        `SELECT DISTINCT
           bk.bookingId, bk.bookingCode, bk.bookingStatus, bk.amountAgreed,
           bk.bookedDate, bk.bookedTime, bk.dateBooked,
           bu.businessName AS serviceTitle,
           CASE WHEN bk.clientUID = ? THEN 'Customer' ELSE 'Provider' END AS involvement
         FROM bookings bk
         LEFT JOIN businesses bu ON bu.businessId = bk.businessId
         WHERE bk.clientUID = ? OR bu.uid = ?
         ORDER BY bk.dateBooked DESC
         LIMIT 30`,
        [uid, uid, uid]
      ),
    ])

    return NextResponse.json({
      success: true,
      data: {
        user,
        wallet: wallet ? {
          ...wallet,
          balance: Number(wallet.balance || 0),
          transactionCount: Number(wallet.transactionCount || 0),
        } : null,
        transactions: transactions.map((item) => ({ ...item, amount: Number(item.amount || 0) })),
        bookings: bookings.map((item) => ({ ...item, amountAgreed: Number(item.amountAgreed || 0) })),
      },
    })
  } catch (error) {
    console.error('support user detail GET error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Could not load user details' }, { status: 500 })
  }
}
