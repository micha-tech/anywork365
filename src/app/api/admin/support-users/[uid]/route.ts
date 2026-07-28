import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { requireSupportApi, unauthorized } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'
import { isMoneyV2Enabled } from '@/lib/money'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'

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

    const useMarketplaceFinance = isMarketplaceFinanceEnabled()
    const useMoneyV2 = !useMarketplaceFinance && isMoneyV2Enabled()
    const wallet = useMarketplaceFinance
      ? await queryOne<AnyRow[]>(
        `SELECT MIN(ma.id) AS walletId, ? AS walletEmail, ma.currency,
                'active' AS walletStatus,
                SUM(CASE WHEN ma.purpose IN (
                  'artisan_available_earnings','client_available','client_refundable'
                ) THEN ma.balance_kobo ELSE 0 END) / 100 AS balance,
                COUNT(DISTINCT me.transaction_id) AS transactionCount
         FROM money_accounts ma
         LEFT JOIN money_entries me ON me.account_id = ma.id
         WHERE ma.owner_type IN ('client','artisan') AND BINARY ma.owner_id = BINARY ?
           AND ma.currency = 'NGN'
         GROUP BY ma.owner_id, ma.currency
         LIMIT 1`,
        [user.email as string, uid]
      )
      : useMoneyV2
      ? await queryOne<AnyRow[]>(
        `SELECT ma.id AS walletId, ? AS walletEmail, ma.currency,
                ma.status AS walletStatus, ma.balance_kobo / 100 AS balance,
                COUNT(DISTINCT me.transaction_id) AS transactionCount
         FROM money_accounts ma
         LEFT JOIN money_entries me ON me.account_id = ma.id
         WHERE ma.owner_type = 'user' AND BINARY ma.owner_id = BINARY ?
           AND ma.purpose = 'available' AND ma.currency = 'NGN'
         GROUP BY ma.id
         LIMIT 1`,
        [user.email as string, uid]
      )
      : await queryOne<AnyRow[]>(
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

    const transactionsPromise = useMarketplaceFinance
      ? query<AnyRow[]>(
        `SELECT mt.id, mt.amount_kobo / 100 AS amount,
                CASE
                  WHEN mt.transaction_type IN ('job_funding_confirmed','withdrawal_returned')
                    THEN 'credit'
                  ELSE 'debit'
                END AS direction,
                NULL AS balanceAfter,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(mt.metadata, '$.description')),
                         REPLACE(mt.transaction_type, '_', ' ')) AS description,
                mt.created_at AS createdAt, mt.reference,
                mt.transaction_type AS type, mt.status
         FROM money_transactions mt
         WHERE BINARY mt.user_uid = BINARY ?
         ORDER BY mt.created_at DESC
         LIMIT 30`,
        [uid]
      )
      : useMoneyV2
      ? query<AnyRow[]>(
        `SELECT mt.id, ABS(me.delta_kobo) / 100 AS amount,
                CASE WHEN me.delta_kobo >= 0 THEN 'credit' ELSE 'debit' END AS direction,
                NULL AS balanceAfter,
                CASE mt.transaction_type
                  WHEN 'wallet_funding' THEN 'Wallet funded via Paystack'
                  WHEN 'booking_escrow_hold' THEN 'Payment held for booking'
                  WHEN 'booking_escrow_release' THEN 'Booking earnings received'
                  WHEN 'booking_escrow_refund' THEN 'Booking payment refunded'
                  WHEN 'withdrawal_reserve' THEN 'Withdrawal requested'
                  WHEN 'withdrawal_failed' THEN 'Withdrawal returned'
                  WHEN 'withdrawal_reversed' THEN 'Withdrawal reversed'
                  WHEN 'legacy_balance_import' THEN 'Opening wallet balance'
                  ELSE REPLACE(mt.transaction_type, '_', ' ')
                END AS description,
                mt.created_at AS createdAt, mt.reference,
                mt.transaction_type AS type, COALESCE(wr.status, mt.status) AS status
         FROM money_entries me
         JOIN money_accounts ma ON ma.id = me.account_id
         JOIN money_transactions mt ON mt.id = me.transaction_id
         LEFT JOIN withdrawal_requests_v2 wr ON wr.reserve_transaction_id = mt.id
         WHERE ma.owner_type = 'user' AND BINARY ma.owner_id = BINARY ?
           AND ma.purpose = 'available'
         ORDER BY mt.created_at DESC
         LIMIT 30`,
        [uid]
      )
      : query<AnyRow[]>(
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
      )

    const [transactions, bookings] = await Promise.all([
      transactionsPromise,
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
