import { NextRequest, NextResponse } from 'next/server'
import { query, type SqlValue } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized } from '@/lib/admin'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'

export async function GET(request: NextRequest) {
  try {
    await requireAdminApi()
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const type = searchParams.get('type') || ''
    const offset = (page - 1) * limit

    if (isMarketplaceFinanceEnabled()) {
      const params: SqlValue[] = []
      let where = ''
      if (type) {
        where = 'WHERE mt.transaction_type = ?'
        params.push(type)
      }
      const countRows = await query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM money_transactions mt ${where}`,
        params
      )
      const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT mt.id, mt.reference, mt.transaction_type AS type, mt.status,
                mt.amount_kobo / 100 AS amount, mt.currency, mt.booking_id AS bookingId,
                mt.external_reference AS providerReference, mt.metadata, mt.created_at,
                u.uid, u.fullName, u.email
         FROM money_transactions mt
         LEFT JOIN users u ON BINARY u.uid = BINARY mt.user_uid
         ${where}
         ORDER BY mt.created_at DESC
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
    if (type) {
      where = 'WHERE wt.type = ?'
      params.push(type)
    }

    const countRows = await query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM wallet_transactions wt ${where}`, params
    )
    const total = countRows[0]?.total ?? 0

    const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
      `SELECT wt.*, u.uid, u.fullName, u.email
       FROM wallet_transactions wt
       LEFT JOIN wallet_ledger wl ON wl.description = wt.reference
       LEFT JOIN wallets w ON w.id = wl.wallet_id
       LEFT JOIN users u ON u.userId = w.user_id
       ${where}
       ORDER BY wt.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    )

    return NextResponse.json({ success: true, data: rows, total, page, limit })
  } catch (err) {
    console.error('admin transactions GET error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
