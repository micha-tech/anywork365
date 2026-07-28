import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { requireSupportApi, unauthorized } from '@/lib/admin'
import { buildAdminUserFilter } from '@/lib/admin-user-filters'
import { query } from '@/lib/db'
import { isMoneyV2Enabled } from '@/lib/money'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'

type SupportUserRow = RowDataPacket & {
  uid: string
  email: string
  fullName: string
  phoneNumber: string
  state: string
  lga: string | null
  address: string
  bio: string | null
  profileImage: string
  role: string
  category: string
  dateJoined: string
  businessName: string | null
  businessContact: string | null
  businessDescription: string | null
  businessLocation: string | null
  businessLogo: string | null
  industryCategory: string | null
  professionalServiceCategory: string | null
  jobTitle: string | null
  qualification: string | null
  yearsExperience: number | null
  coverImageUrl: string | null
  companyName: string | null
  companySize: string | null
  recruitmentFunction: string | null
  position: string | null
  portfolioCount: number
  walletBalance: number
  bookingCount: number
  lastActivityAt: string
  profileCompletion: number
}

const PROFILE_JOINS = `
  LEFT JOIN businesses b
    ON b.businessId = (
      SELECT MAX(b2.businessId)
      FROM businesses b2
      WHERE BINARY b2.uid = BINARY u.uid AND b2.deleted = 0
    )
  LEFT JOIN professional_profiles pp ON BINARY pp.uid = BINARY u.uid
  LEFT JOIN recruiter_profiles rp ON BINARY rp.uid = BINARY u.uid
  LEFT JOIN (
    SELECT uid, COUNT(*) AS portfolioCount
    FROM user_portfolio
    GROUP BY uid
  ) pf ON BINARY pf.uid = BINARY u.uid
`

const BOOKING_JOINS = `
  LEFT JOIN (
    SELECT clientUID AS uid, COUNT(*) AS bookingCount, MAX(dateBooked) AS lastBooking
    FROM bookings
    GROUP BY clientUID
  ) cb ON BINARY cb.uid = BINARY u.uid
  LEFT JOIN (
    SELECT bu.uid, COUNT(*) AS bookingCount, MAX(bk.dateBooked) AS lastBooking
    FROM bookings bk
    JOIN businesses bu ON bu.businessId = bk.businessId
    GROUP BY bu.uid
  ) vb ON BINARY vb.uid = BINARY u.uid
`

const LEGACY_WALLET_JOIN = `
  LEFT JOIN (
    SELECT w.user_id,
           SUM(CASE WHEN wl.direction = 'credit' THEN wl.amount ELSE -wl.amount END) AS walletBalance,
           MAX(wl.created_at) AS lastWalletActivity
    FROM wallets w
    LEFT JOIN wallet_ledger wl ON wl.wallet_id = w.id
    GROUP BY w.user_id
  ) wa ON wa.user_id = u.userId
`

const MONEY_V2_WALLET_JOIN = `
  LEFT JOIN (
    SELECT ma.owner_id AS uid,
           MAX(CASE WHEN ma.purpose = 'available' THEN ma.balance_kobo ELSE 0 END) / 100 AS walletBalance,
           MAX(me.created_at) AS lastWalletActivity
    FROM money_accounts ma
    LEFT JOIN money_entries me ON me.account_id = ma.id
    WHERE ma.owner_type = 'user' AND ma.currency = 'NGN'
    GROUP BY ma.owner_id
  ) wa ON BINARY wa.uid = BINARY u.uid
`

const MARKETPLACE_WALLET_JOIN = `
  LEFT JOIN (
    SELECT ma.owner_id AS uid,
           SUM(CASE
             WHEN ma.purpose IN ('artisan_available_earnings','client_available','client_refundable')
             THEN ma.balance_kobo ELSE 0 END) / 100 AS walletBalance,
           MAX(me.created_at) AS lastWalletActivity
    FROM money_accounts ma
    LEFT JOIN money_entries me ON me.account_id = ma.id
    WHERE ma.owner_type IN ('client','artisan') AND ma.currency = 'NGN'
    GROUP BY ma.owner_id
  ) wa ON BINARY wa.uid = BINARY u.uid
`

function supportJoins(): string {
  const walletJoin = isMarketplaceFinanceEnabled()
    ? MARKETPLACE_WALLET_JOIN
    : isMoneyV2Enabled()
      ? MONEY_V2_WALLET_JOIN
      : LEGACY_WALLET_JOIN
  return `${PROFILE_JOINS}${walletJoin}${BOOKING_JOINS}`
}

const ROLE_EXPRESSION = `COALESCE(
  u.role,
  CASE WHEN u.hasBusinessAccount = 1 THEN 'artisan' ELSE 'client' END
)`

const BASE_SCORE = `(
  (NULLIF(TRIM(u.email), '') IS NOT NULL) +
  (NULLIF(TRIM(u.fullName), '') IS NOT NULL) +
  (NULLIF(TRIM(u.phoneNumber), '') IS NOT NULL) +
  (NULLIF(TRIM(u.state), '') IS NOT NULL) +
  (NULLIF(TRIM(COALESCE(u.lga, '')), '') IS NOT NULL) +
  (NULLIF(TRIM(u.address), '') IS NOT NULL) +
  (NULLIF(TRIM(COALESCE(u.bio, '')), '') IS NOT NULL) +
  (NULLIF(TRIM(u.profileImage), '') IS NOT NULL)
)`

const ROLE_SCORE = `CASE ${ROLE_EXPRESSION}
  WHEN 'artisan' THEN
    (NULLIF(TRIM(COALESCE(b.businessName, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(b.category, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(b.businessContact, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(b.description, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(b.location, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(b.businessLogo, '')), '') IS NOT NULL)
  WHEN 'professional' THEN
    (NULLIF(TRIM(COALESCE(pp.industry_category, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(pp.professional_service_category, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(pp.job_title, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(pp.qualification, '')), '') IS NOT NULL) +
    (pp.years_experience IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(pp.cover_image_url, '')), '') IS NOT NULL)
  WHEN 'recruiter' THEN
    (NULLIF(TRIM(COALESCE(rp.company_name, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(rp.company_size, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(rp.industry_category, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(rp.recruitment_function, '')), '') IS NOT NULL) +
    (NULLIF(TRIM(COALESCE(rp.position, '')), '') IS NOT NULL)
  ELSE 0
END`

const ROLE_TOTAL = `CASE ${ROLE_EXPRESSION}
  WHEN 'artisan' THEN 14
  WHEN 'professional' THEN 14
  WHEN 'recruiter' THEN 13
  ELSE 8
END`

const PROFILE_COMPLETION = `ROUND(100 * (${BASE_SCORE} + (${ROLE_SCORE})) / (${ROLE_TOTAL}))`

function missingSteps(user: SupportUserRow): string[] {
  const missing: string[] = []
  const add = (value: unknown, label: string) => {
    if (value === null || value === undefined || String(value).trim() === '') missing.push(label)
  }

  add(user.fullName, 'Full name')
  add(user.email, 'Email address')
  add(user.phoneNumber, 'Phone number')
  add(user.profileImage, 'Profile photo')
  add(user.state, 'State')
  add(user.lga, 'Local government')
  add(user.address, 'Address')
  add(user.bio, 'Profile bio')

  if (user.role === 'artisan') {
    add(user.businessName, 'Business name')
    add(user.category, 'Service category')
    add(user.businessContact, 'Business contact')
    add(user.businessDescription, 'Business description')
    add(user.businessLocation, 'Business location')
    add(user.businessLogo, 'Business logo')
  } else if (user.role === 'professional') {
    add(user.industryCategory, 'Industry')
    add(user.professionalServiceCategory, 'Professional service')
    add(user.jobTitle, 'Job title')
    add(user.qualification, 'Qualification')
    if (user.yearsExperience === null || user.yearsExperience === undefined) missing.push('Experience')
    add(user.coverImageUrl, 'Cover image')
  } else if (user.role === 'recruiter') {
    add(user.companyName, 'Company name')
    add(user.companySize, 'Company size')
    add(user.industryCategory, 'Industry')
    add(user.recruitmentFunction, 'Recruitment function')
    add(user.position, 'Position')
  }

  return missing
}

export async function GET(request: NextRequest) {
  try {
    await requireSupportApi()

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10)))
    const category = (searchParams.get('category') || '').trim().slice(0, 160)
    const progress = searchParams.get('progress') || ''
    const joins = supportJoins()
    const { where: initialWhere, params } = buildAdminUserFilter(
      searchParams.get('search') || '',
      searchParams.get('role') || ''
    )

    let where = `${initialWhere} AND (u.role IS NULL OR u.role NOT IN ('admin', 'support'))`
    if (category) {
      where += ` AND COALESCE(
        NULLIF(b.category, ''),
        NULLIF(pp.professional_service_category, ''),
        NULLIF(rp.industry_category, ''),
        'General'
      ) = BINARY ?`
      params.push(category)
    }

    const baseQuery = `
      SELECT
        u.uid, u.email, u.fullName, u.phoneNumber, u.state, u.lga, u.address, u.bio,
        u.profileImage, ${ROLE_EXPRESSION} AS role, u.dateJoined,
        COALESCE(
          NULLIF(b.category, ''),
          NULLIF(pp.professional_service_category, ''),
          NULLIF(rp.industry_category, ''),
          'General'
        ) AS category,
        b.businessName, b.businessContact, b.description AS businessDescription,
        b.location AS businessLocation, b.businessLogo,
        pp.industry_category AS industryCategory,
        pp.professional_service_category AS professionalServiceCategory,
        pp.job_title AS jobTitle, pp.qualification,
        pp.years_experience AS yearsExperience, pp.cover_image_url AS coverImageUrl,
        rp.company_name AS companyName, rp.company_size AS companySize,
        rp.recruitment_function AS recruitmentFunction, rp.position,
        COALESCE(pf.portfolioCount, 0) AS portfolioCount,
        COALESCE(wa.walletBalance, 0) AS walletBalance,
        COALESCE(cb.bookingCount, 0) + COALESCE(vb.bookingCount, 0) AS bookingCount,
        GREATEST(
          u.dateJoined,
          COALESCE(wa.lastWalletActivity, u.dateJoined),
          COALESCE(cb.lastBooking, u.dateJoined),
          COALESCE(vb.lastBooking, u.dateJoined)
        ) AS lastActivityAt,
        ${PROFILE_COMPLETION} AS profileCompletion
      FROM users u
      ${joins}
      ${where}
    `

    let progressWhere = ''
    if (progress === 'attention') progressWhere = 'WHERE profileCompletion < 50'
    if (progress === 'in-progress') progressWhere = 'WHERE profileCompletion BETWEEN 50 AND 79'
    if (progress === 'almost') progressWhere = 'WHERE profileCompletion BETWEEN 80 AND 99'
    if (progress === 'complete') progressWhere = 'WHERE profileCompletion = 100'

    const outerQuery = `FROM (${baseQuery}) support_users ${progressWhere}`
    const [countRows, summaryRows, rows, categoryRows] = await Promise.all([
      query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total ${outerQuery}`,
        params
      ),
      query<(RowDataPacket & {
        averageCompletion: number
        needsAttention: number
        completeProfiles: number
      })[]>(
        `SELECT
           COALESCE(ROUND(AVG(profileCompletion)), 0) AS averageCompletion,
           COALESCE(SUM(profileCompletion < 50), 0) AS needsAttention,
           COALESCE(SUM(profileCompletion = 100), 0) AS completeProfiles
         ${outerQuery}`,
        params
      ),
      query<SupportUserRow[]>(
        `SELECT * ${outerQuery}
         ORDER BY profileCompletion ASC, lastActivityAt DESC
         LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params
      ),
      query<(RowDataPacket & { category: string })[]>(
        `SELECT DISTINCT COALESCE(
           NULLIF(b.category, ''),
           NULLIF(pp.professional_service_category, ''),
           NULLIF(rp.industry_category, ''),
           'General'
         ) AS category
         FROM users u
         ${joins}
         WHERE u.deleted = 0 AND (u.role IS NULL OR u.role NOT IN ('admin', 'support'))
         ORDER BY category`,
        []
      ),
    ])

    const total = Number(countRows[0]?.total || 0)
    const summary = summaryRows[0] || {
      averageCompletion: 0,
      needsAttention: 0,
      completeProfiles: 0,
    }

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        profileCompletion: Number(row.profileCompletion),
        walletBalance: Number(row.walletBalance),
        bookingCount: Number(row.bookingCount),
        portfolioCount: Number(row.portfolioCount),
        missingSteps: missingSteps(row),
      })),
      total,
      page,
      limit,
      summary: {
        averageCompletion: Number(summary.averageCompletion),
        needsAttention: Number(summary.needsAttention),
        completeProfiles: Number(summary.completeProfiles),
      },
      categories: categoryRows.map((row) => row.category).filter(Boolean),
    })
  } catch (error) {
    console.error('support users GET error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Could not load the support queue' }, { status: 500 })
  }
}
