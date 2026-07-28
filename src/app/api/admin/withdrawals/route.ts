import { NextRequest, NextResponse } from 'next/server'
import { query, type SqlValue } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized } from '@/lib/admin'
import { isMoneyV2Enabled } from '@/lib/money'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { requireFinancialPermission } from '@/lib/financial/admin-permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminApi()
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const status = searchParams.get('status') || ''
    const offset = (page - 1) * limit

    if (isMarketplaceFinanceEnabled()) {
      await requireFinancialPermission(session.id, 'financial_reports.view')
      const params: SqlValue[] = []
      let where = ''
      if (status) {
        where = 'WHERE wr.status = ?'
        params.push(status)
      }
      const countRows = await query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM marketplace_withdrawal_requests wr ${where}`,
        params
      )
      const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT wr.id, wr.internal_reference AS reference, wr.artisan_uid AS user_uid,
                wr.amount_kobo / 100 AS amount, tr.bank_name AS bankName,
                tr.account_number_last_four AS accountLast4, wr.status,
                wr.risk_status AS riskStatus, wr.failure_reason AS failureReason,
                wr.created_at AS createdAt, wr.updated_at AS updatedAt,
                u.fullName, u.email
         FROM marketplace_withdrawal_requests wr
         JOIN transfer_recipients tr ON tr.id = wr.recipient_id
         LEFT JOIN users u ON BINARY u.uid = BINARY wr.artisan_uid
         ${where}
         ORDER BY wr.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      )
      return NextResponse.json({
        success: true,
        data: rows,
        total: Number(countRows[0]?.total || 0),
        page,
        limit,
      })
    }

    if (isMoneyV2Enabled()) {
      const params: SqlValue[] = []
      let where = ''
      if (status) {
        where = 'WHERE wr.status = ?'
        params.push(status)
      }
      const countRows = await query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM withdrawal_requests_v2 wr ${where}`,
        params
      )
      const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT wr.id, wr.reference, wr.user_uid, wr.amount_kobo / 100 AS amount,
                wr.bank_name AS bankName, wr.account_last4 AS accountLast4,
                wr.status, wr.created_at AS createdAt, wr.updated_at AS updatedAt,
                u.fullName, u.email
         FROM withdrawal_requests_v2 wr
         LEFT JOIN users u ON BINARY u.uid = BINARY wr.user_uid
         ${where}
         ORDER BY wr.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      )
      return NextResponse.json({
        success: true,
        data: rows,
        total: Number(countRows[0]?.total || 0),
        page,
        limit,
      })
    }

    let where = ''
    const params: SqlValue[] = []
    if (status) {
      where = 'WHERE wr.status = ?'
      params.push(status)
    }

    const countRows = await query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM withdrawals wr ${where}`, params
    )
    const total = countRows[0]?.total ?? 0

    const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
      `SELECT wr.*, u.fullName, u.email
       FROM withdrawals wr
       LEFT JOIN users u ON u.userId = wr.user_id
       ${where}
       ORDER BY wr.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    )

    return NextResponse.json({ success: true, data: rows, total, page, limit })
  } catch (err) {
    console.error('admin withdrawals GET error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
