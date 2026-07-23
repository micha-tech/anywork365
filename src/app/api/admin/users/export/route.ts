import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized, logAdminAction } from '@/lib/admin'
import { buildAdminUserFilter } from '@/lib/admin-user-filters'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

interface ExportUserRow extends RowDataPacket {
  uid: string
  email: string
  fullName: string
  phoneNumber: string
  state: string
  lga: string | null
  role: string | null
  hasBusinessAccount: number
  verified: number
  suspended: number
  loginProvider: string
  dateJoined: Date | string
  walletBalance: number | string
}

function csvCell(value: unknown, forceText = false): string {
  let text = value === null || value === undefined ? '' : String(value)

  if (forceText && text) {
    text = `'${text}`
  } else if (/^[=+\-@]/.test(text.trimStart())) {
    // Prevent spreadsheet formula execution when an exported value is opened.
    text = `'${text}`
  }

  return `"${text.replace(/"/g, '""')}"`
}

function effectiveRole(row: ExportUserRow): string {
  if (row.role) return row.role
  return row.hasBusinessAccount ? 'artisan' : 'client'
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminApi()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const { where, params } = buildAdminUserFilter(search, role)

    const rows = await query<ExportUserRow[]>(
      `SELECT u.uid, u.email, u.fullName, u.phoneNumber, u.state, u.lga,
              u.role, u.hasBusinessAccount, u.verified, u.suspended,
              u.loginProvider, u.dateJoined,
              COALESCE(w.availableBalance, 0) AS walletBalance
       FROM users u
       LEFT JOIN (
         SELECT w.user_id,
                SUM(CASE WHEN wl.direction = 'credit' THEN wl.amount ELSE -wl.amount END) AS availableBalance
         FROM wallet_ledger wl
         JOIN wallets w ON w.id = wl.wallet_id
         GROUP BY w.user_id
       ) w ON w.user_id = u.userId
       ${where}
       ORDER BY u.dateJoined DESC`,
      params
    )

    const headers = [
      'User UID',
      'Full Name',
      'Email',
      'Phone Number',
      'Role',
      'State',
      'LGA',
      'Account Status',
      'Verified',
      'Login Provider',
      'Wallet Balance (NGN)',
      'Date Joined',
    ]

    const lines = [
      headers.map((header) => csvCell(header)).join(','),
      ...rows.map((row) => [
        csvCell(row.uid, true),
        csvCell(row.fullName),
        csvCell(row.email),
        csvCell(row.phoneNumber, true),
        csvCell(effectiveRole(row)),
        csvCell(row.state),
        csvCell(row.lga),
        csvCell(row.suspended ? 'Suspended' : 'Active'),
        csvCell(row.verified ? 'Yes' : 'No'),
        csvCell(row.loginProvider),
        csvCell(Number(row.walletBalance || 0).toFixed(2)),
        csvCell(formatDate(row.dateJoined)),
      ].join(',')),
    ]

    await logAdminAction(session.id, 'export_users_csv', 'users', undefined, {
      exportedCount: rows.length,
      search: search.trim().slice(0, 200) || null,
      role: role || null,
    })

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(`\uFEFF${lines.join('\r\n')}\r\n`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="anywork365-users-${date}.csv"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('admin users export error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json(
      { success: false, error: 'Could not export users. Please try again.' },
      { status: 500 }
    )
  }
}
