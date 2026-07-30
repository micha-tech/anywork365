import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized } from '@/lib/admin'
import { query, queryOne, type SqlValue } from '@/lib/db'
import { requireFinancialPermission } from '@/lib/financial/admin-permissions'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { getPaystackBalance } from '@/lib/paystack'

type View =
  | 'overview'
  | 'ledger'
  | 'job_funds'
  | 'refunds'
  | 'risk'
  | 'audit'

const views = new Set<View>([
  'overview',
  'ledger',
  'job_funds',
  'refunds',
  'risk',
  'audit',
])

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminApi()
    if (!isMarketplaceFinanceEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Marketplace finance is not enabled' },
        { status: 503 }
      )
    }
    await requireFinancialPermission(session.id, 'financial_reports.view')

    const rawView = request.nextUrl.searchParams.get('view') || 'overview'
    if (!views.has(rawView as View)) {
      return NextResponse.json({ success: false, error: 'Invalid moderation view' }, { status: 400 })
    }
    const view = rawView as View
    if (view === 'overview') return overview()

    const page = positiveInteger(request.nextUrl.searchParams.get('page'), 1)
    const limit = Math.min(50, positiveInteger(request.nextUrl.searchParams.get('limit'), 25))
    const status = cleanFilter(request.nextUrl.searchParams.get('status'), 40)
    const search = cleanFilter(request.nextUrl.searchParams.get('search'), 160)
    const offset = (page - 1) * limit

    if (view === 'ledger') return ledger({ page, limit, offset, status, search })
    if (view === 'job_funds') return jobFunds({ page, limit, offset, status, search })
    if (view === 'refunds') return refunds({ page, limit, offset, status, search })
    if (view === 'risk') return risk({ page, limit, offset, status, search })
    return audit({ page, limit, offset, search })
  } catch (error) {
    console.error('[MODERATION CONSOLE]', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Could not load financial operations' },
      { status: 500 }
    )
  }
}

async function overview() {
  const [
    accountRows,
    jobFundRows,
    withdrawalRows,
    refundRows,
    operations,
    latestReconciliation,
    recentActivity,
    paystackBalance,
  ] = await Promise.all([
    query<(RowDataPacket & {
      purpose: string
      classification: string
      balanceMinor: string | number
    })[]>(
      `SELECT ma.purpose, map.classification, COALESCE(SUM(ma.balance_kobo), 0) AS balanceMinor
       FROM money_accounts ma
       JOIN money_account_policies map ON map.account_id = ma.id
       GROUP BY ma.purpose, map.classification
       ORDER BY map.classification, ma.purpose`
    ),
    query<(RowDataPacket & { status: string; count: number; amountMinor: string | number })[]>(
      `SELECT status, COUNT(*) AS count,
              COALESCE(SUM(expected_amount_kobo), 0) AS amountMinor
       FROM job_funds GROUP BY status`
    ),
    query<(RowDataPacket & { status: string; count: number; amountMinor: string | number })[]>(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount_kobo), 0) AS amountMinor
       FROM marketplace_withdrawal_requests GROUP BY status`
    ),
    query<(RowDataPacket & { status: string; count: number; amountMinor: string | number })[]>(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount_kobo), 0) AS amountMinor
       FROM refund_requests GROUP BY status`
    ),
    queryOne<(RowDataPacket & {
      providerDeadLetters: number
      staleProviderEvents: number
      outboxDeadLetters: number
      staleOutbox: number
      activeRiskHolds: number
      openDisputes: number
      pendingWithdrawals: number
      pendingRefunds: number
    })[]>(
      `SELECT
         (SELECT COUNT(*) FROM provider_events WHERE processing_status = 'dead_letter')
           AS providerDeadLetters,
         (SELECT COUNT(*) FROM provider_events
           WHERE processing_status IN ('verified','processing','failed')
             AND received_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE))
           AS staleProviderEvents,
         (SELECT COUNT(*) FROM financial_outbox_events WHERE status = 'dead_letter')
           AS outboxDeadLetters,
         (SELECT COUNT(*) FROM financial_outbox_events
           WHERE status IN ('pending','processing','failed')
             AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE))
           AS staleOutbox,
         (SELECT COUNT(*) FROM risk_holds WHERE status = 'active') AS activeRiskHolds,
         (SELECT COUNT(*) FROM financial_disputes WHERE status IN ('open','under_review'))
           AS openDisputes,
         (SELECT COUNT(*) FROM marketplace_withdrawal_requests
           WHERE status IN ('requested','under_review','approved','processing'))
           AS pendingWithdrawals,
         (SELECT COUNT(*) FROM refund_requests
           WHERE status IN ('requested','processing','needs_attention'))
           AS pendingRefunds`
    ),
    queryOne<(RowDataPacket & {
      id: number
      status: string
      issueCount: number
      startedAt: Date
      completedAt: Date | null
    })[]>(
      `SELECT id, status, issue_count AS issueCount, started_at AS startedAt,
              completed_at AS completedAt
       FROM money_reconciliation_runs ORDER BY id DESC LIMIT 1`
    ),
    query<(RowDataPacket & {
      id: number
      actorType: string
      actorId: string
      action: string
      resourceType: string
      resourceId: string
      internalReference: string | null
      reason: string | null
      createdAt: Date
    })[]>(
      `SELECT id, actor_type AS actorType, actor_id AS actorId, action,
              resource_type AS resourceType, resource_id AS resourceId,
              internal_reference AS internalReference, reason, created_at AS createdAt
       FROM financial_audit_logs ORDER BY created_at DESC LIMIT 12`
    ),
    loadPaystackBalance(),
  ])

  return NextResponse.json({
    success: true,
    data: {
      accounts: accountRows.map((row) => ({ ...row, balanceMinor: Number(row.balanceMinor) })),
      jobFunds: jobFundRows.map((row) => ({ ...row, count: Number(row.count), amountMinor: Number(row.amountMinor) })),
      withdrawals: withdrawalRows.map((row) => ({ ...row, count: Number(row.count), amountMinor: Number(row.amountMinor) })),
      refunds: refundRows.map((row) => ({ ...row, count: Number(row.count), amountMinor: Number(row.amountMinor) })),
      operations,
      latestReconciliation,
      recentActivity,
      paystackBalance,
      generatedAt: new Date().toISOString(),
    },
  })
}

type PageInput = {
  page: number
  limit: number
  offset: number
  status: string
  search: string
}

async function ledger(input: PageInput) {
  const clauses: string[] = []
  const params: SqlValue[] = []
  if (input.status) {
    clauses.push('mt.status = ?')
    params.push(input.status)
  }
  if (input.search) {
    clauses.push(`(
      mt.reference LIKE ? OR mt.external_reference LIKE ? OR
      mt.user_uid LIKE ? OR u.email LIKE ? OR u.fullName LIKE ?
    )`)
    const value = `%${input.search}%`
    params.push(value, value, value, value, value)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const countRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total
     FROM money_transactions mt
     LEFT JOIN users u ON BINARY u.uid = BINARY mt.user_uid
     ${where}`,
    params
  )
  const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
     `SELECT mt.id, mt.reference, mt.transaction_type AS transactionType,
            mt.amount_kobo AS amountMinor, mt.currency, mt.status,
            mt.user_uid AS userUid, mt.booking_id AS bookingId,
            mt.external_reference AS providerReference, mt.created_at AS createdAt,
            u.fullName, u.email
     FROM money_transactions mt
     LEFT JOIN users u ON BINARY u.uid = BINARY mt.user_uid
     ${where}
     ORDER BY mt.created_at DESC
     LIMIT ${input.limit} OFFSET ${input.offset}`,
    params
  )
  return paged(rows, Number(countRows[0]?.total || 0), input)
}

async function jobFunds(input: PageInput) {
  const clauses: string[] = []
  const params: SqlValue[] = []
  if (input.status) {
    clauses.push('jf.status = ?')
    params.push(input.status)
  }
  if (input.search) {
    clauses.push(`(
      CAST(jf.booking_id AS CHAR) LIKE ? OR jf.client_uid LIKE ? OR jf.artisan_uid LIKE ? OR
      client.email LIKE ? OR artisan.email LIKE ? OR client.fullName LIKE ? OR artisan.fullName LIKE ?
    )`)
    const value = `%${input.search}%`
    params.push(value, value, value, value, value, value, value)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const countRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total
     FROM job_funds jf
     LEFT JOIN users client ON BINARY client.uid = BINARY jf.client_uid
     LEFT JOIN users artisan ON BINARY artisan.uid = BINARY jf.artisan_uid
     ${where}`,
    params
  )
  const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
    `SELECT jf.id, jf.booking_id AS bookingId, jf.client_uid AS clientUid,
            jf.artisan_uid AS artisanUid, jf.expected_amount_kobo AS amountMinor,
            jf.locked_amount_kobo AS lockedMinor, jf.released_amount_kobo AS releasedMinor,
            jf.refunded_amount_kobo AS refundedMinor, jf.platform_fee_kobo AS feeMinor,
            jf.currency, jf.status, jf.funded_at AS fundedAt, jf.released_at AS releasedAt,
            jf.created_at AS createdAt, client.fullName AS clientName,
            client.email AS clientEmail, artisan.fullName AS artisanName,
            artisan.email AS artisanEmail
     FROM job_funds jf
     LEFT JOIN users client ON BINARY client.uid = BINARY jf.client_uid
     LEFT JOIN users artisan ON BINARY artisan.uid = BINARY jf.artisan_uid
     ${where}
     ORDER BY jf.created_at DESC
     LIMIT ${input.limit} OFFSET ${input.offset}`,
    params
  )
  return paged(rows, Number(countRows[0]?.total || 0), input)
}

async function refunds(input: PageInput) {
  const clauses: string[] = []
  const params: SqlValue[] = []
  if (input.status) {
    clauses.push('rr.status = ?')
    params.push(input.status)
  }
  if (input.search) {
    clauses.push(`(
      rr.internal_reference LIKE ? OR rr.provider_refund_reference LIKE ? OR
      CAST(jf.booking_id AS CHAR) LIKE ? OR client.email LIKE ? OR client.fullName LIKE ?
    )`)
    const value = `%${input.search}%`
    params.push(value, value, value, value, value)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const countRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total
     FROM refund_requests rr
     JOIN job_funds jf ON jf.id = rr.job_fund_id
     LEFT JOIN users client ON BINARY client.uid = BINARY jf.client_uid
     ${where}`,
    params
  )
  const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
    `SELECT rr.id, rr.internal_reference AS reference, rr.amount_kobo AS amountMinor,
            rr.currency, rr.status, rr.reason,
            rr.provider_refund_reference AS providerReference,
            rr.created_at AS createdAt, rr.completed_at AS completedAt,
            jf.booking_id AS bookingId, jf.client_uid AS clientUid,
            client.fullName AS clientName, client.email AS clientEmail
     FROM refund_requests rr
     JOIN job_funds jf ON jf.id = rr.job_fund_id
     LEFT JOIN users client ON BINARY client.uid = BINARY jf.client_uid
     ${where}
     ORDER BY rr.created_at DESC
     LIMIT ${input.limit} OFFSET ${input.offset}`,
    params
  )
  return paged(rows, Number(countRows[0]?.total || 0), input)
}

async function risk(input: PageInput) {
  const clauses: string[] = []
  const params: SqlValue[] = []
  if (input.status) {
    clauses.push('fd.status = ?')
    params.push(input.status)
  }
  if (input.search) {
    clauses.push(`(
      fd.provider_dispute_id LIKE ? OR CAST(jf.booking_id AS CHAR) LIKE ? OR
      jf.client_uid LIKE ? OR jf.artisan_uid LIKE ? OR client.email LIKE ? OR artisan.email LIKE ?
    )`)
    const value = `%${input.search}%`
    params.push(value, value, value, value, value, value)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const countRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total
     FROM financial_disputes fd
     JOIN job_funds jf ON jf.id = fd.job_fund_id
     LEFT JOIN users client ON BINARY client.uid = BINARY jf.client_uid
     LEFT JOIN users artisan ON BINARY artisan.uid = BINARY jf.artisan_uid
     ${where}`,
    params
  )
  const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
    `SELECT fd.id, fd.provider, fd.provider_dispute_id AS providerDisputeId,
            fd.amount_kobo AS amountMinor, fd.currency, fd.status, fd.reason,
            fd.created_at AS createdAt, fd.resolved_at AS resolvedAt,
            jf.booking_id AS bookingId, jf.client_uid AS clientUid,
            jf.artisan_uid AS artisanUid, client.fullName AS clientName,
            artisan.fullName AS artisanName,
            COALESCE((
              SELECT SUM(rh.amount_kobo) FROM risk_holds rh
              WHERE rh.source_type = 'financial_dispute'
                AND rh.source_id = CAST(fd.id AS CHAR) AND rh.status = 'active'
            ), 0) AS heldMinor
     FROM financial_disputes fd
     JOIN job_funds jf ON jf.id = fd.job_fund_id
     LEFT JOIN users client ON BINARY client.uid = BINARY jf.client_uid
     LEFT JOIN users artisan ON BINARY artisan.uid = BINARY jf.artisan_uid
     ${where}
     ORDER BY fd.created_at DESC
     LIMIT ${input.limit} OFFSET ${input.offset}`,
    params
  )
  return paged(rows, Number(countRows[0]?.total || 0), input)
}

async function audit(input: Omit<PageInput, 'status'>) {
  const params: SqlValue[] = []
  let where = ''
  if (input.search) {
    where = `WHERE (
      fal.action LIKE ? OR fal.resource_type LIKE ? OR fal.resource_id LIKE ? OR
      fal.internal_reference LIKE ? OR fal.actor_id LIKE ?
    )`
    const value = `%${input.search}%`
    params.push(value, value, value, value, value)
  }
  const countRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM financial_audit_logs fal ${where}`,
    params
  )
  const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(
    `SELECT fal.id, fal.actor_type AS actorType, fal.actor_id AS actorId,
            fal.action, fal.resource_type AS resourceType,
            fal.resource_id AS resourceId, fal.internal_reference AS internalReference,
            fal.reason, fal.created_at AS createdAt, u.fullName AS actorName, u.email AS actorEmail
     FROM financial_audit_logs fal
     LEFT JOIN users u ON BINARY u.uid = BINARY fal.actor_id
     ${where}
     ORDER BY fal.created_at DESC
     LIMIT ${input.limit} OFFSET ${input.offset}`,
    params
  )
  return paged(rows, Number(countRows[0]?.total || 0), input)
}

function paged(rows: RowDataPacket[], total: number, input: { page: number; limit: number }) {
  return NextResponse.json({
    success: true,
    data: rows,
    total,
    page: input.page,
    limit: input.limit,
  })
}

async function loadPaystackBalance(): Promise<{
  status: 'available' | 'unavailable'
  currency: string
  balanceMinor: number | null
}> {
  try {
    const result = await getPaystackBalance()
    const ngn = result.data.find((item) => item.currency === 'NGN')
    return {
      status: 'available',
      currency: 'NGN',
      balanceMinor: ngn?.balance ?? 0,
    }
  } catch (error) {
    console.warn('[MODERATION PAYSTACK BALANCE]', error instanceof Error ? error.message : error)
    return { status: 'unavailable', currency: 'NGN', balanceMinor: null }
  }
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function cleanFilter(value: string | null, max: number): string {
  return (value || '').trim().slice(0, max)
}
