import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized } from '@/lib/admin'
import { query, type SqlValue } from '@/lib/db'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { requireFinancialPermission } from '@/lib/financial/admin-permissions'

const reportTypes = [
  'user_statement',
  'artisan_earnings',
  'client_payments',
  'withdrawals',
  'platform_commission',
  'refunds',
  'failed_payments',
  'failed_withdrawals',
  'daily_summary',
  'reconciliation_variance',
] as const
type ReportType = (typeof reportTypes)[number]

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminApi()
    if (!isMarketplaceFinanceEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Marketplace finance v3 is disabled' },
        { status: 503 }
      )
    }
    await requireFinancialPermission(session.id, 'financial_reports.view')
    const type = request.nextUrl.searchParams.get('type') as ReportType | null
    if (!type || !reportTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Report type must be one of: ${reportTypes.join(', ')}` },
        { status: 400 }
      )
    }
    const uid = request.nextUrl.searchParams.get('uid')
    if ((type === 'user_statement' || type === 'artisan_earnings' || type === 'client_payments') && !uid) {
      return NextResponse.json(
        { success: false, error: 'uid is required for this report' },
        { status: 400 }
      )
    }
    const from = validDate(request.nextUrl.searchParams.get('from')) || '1970-01-01'
    const to = validDate(request.nextUrl.searchParams.get('to')) || '2999-12-31'
    const { sql, params } = reportQuery(type, { uid, from, to })
    const rows = await query<(RowDataPacket & Record<string, unknown>)[]>(sql, params)
    return NextResponse.json({
      success: true,
      data: {
        type,
        filters: { uid, from, to },
        records: rows,
        recordCount: rows.length,
        generatedAt: new Date().toISOString(),
        source: 'immutable_financial_records',
      },
    })
  } catch (error) {
    console.error('[ADMIN FINANCE REPORT]', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json(
      { success: false, error: 'Could not generate financial report' },
      { status: 500 }
    )
  }
}

function reportQuery(
  type: ReportType,
  filters: { uid: string | null; from: string; to: string }
): { sql: string; params: SqlValue[] } {
  const dates = [filters.from, filters.to]
  if (type === 'user_statement') {
    return {
      sql: `SELECT mt.reference, mt.transaction_type, mt.amount_kobo AS amountMinor,
                   mt.currency, mt.status, mt.booking_id AS bookingId,
                   mt.external_reference AS providerReference, mt.metadata, mt.created_at AS createdAt
            FROM money_transactions mt
            WHERE BINARY mt.user_uid = BINARY ? AND DATE(mt.created_at) BETWEEN ? AND ?
            ORDER BY mt.id`,
      params: [filters.uid!, ...dates],
    }
  }
  if (type === 'artisan_earnings') {
    return {
      sql: `SELECT mt.reference, mt.transaction_type, mt.amount_kobo AS grossAmountMinor,
                   JSON_UNQUOTE(JSON_EXTRACT(mt.metadata, '$.feeMinor')) AS platformFeeMinor,
                   JSON_UNQUOTE(JSON_EXTRACT(mt.metadata, '$.earningsMinor')) AS earningsMinor,
                   mt.booking_id AS bookingId, mt.created_at AS createdAt
            FROM money_transactions mt
            WHERE BINARY mt.user_uid = BINARY ?
              AND mt.transaction_type IN ('job_funds_released','earnings_hold_released')
              AND DATE(mt.created_at) BETWEEN ? AND ?
            ORDER BY mt.id`,
      params: [filters.uid!, ...dates],
    }
  }
  if (type === 'client_payments') {
    return {
      sql: `SELECT mpi.internal_reference AS reference, mpi.provider_reference AS providerReference,
                   mpi.booking_id AS bookingId, mpi.amount_kobo AS amountMinor,
                   mpi.currency, mpi.status, mpi.payment_method AS paymentMethod,
                   mpi.confirmed_at AS confirmedAt, mpi.created_at AS createdAt
            FROM marketplace_payment_intents mpi
            WHERE BINARY mpi.client_uid = BINARY ? AND DATE(mpi.created_at) BETWEEN ? AND ?
            ORDER BY mpi.id`,
      params: [filters.uid!, ...dates],
    }
  }
  if (type === 'withdrawals' || type === 'failed_withdrawals') {
    return {
      sql: `SELECT wr.internal_reference AS reference, wr.artisan_uid AS artisanUid,
                   wr.amount_kobo AS amountMinor, wr.fee_kobo AS feeMinor,
                   wr.net_amount_kobo AS netAmountMinor, wr.currency, wr.status,
                   wr.risk_status AS riskStatus, wr.provider_reference AS providerReference,
                   tr.bank_name AS bankName, tr.account_number_last_four AS accountLastFour,
                   wr.created_at AS createdAt
            FROM marketplace_withdrawal_requests wr
            JOIN transfer_recipients tr ON tr.id = wr.recipient_id
            WHERE ${type === 'failed_withdrawals' ? "wr.status IN ('failed','reversed')" : '1 = 1'}
              AND DATE(wr.created_at) BETWEEN ? AND ?
            ORDER BY wr.id`,
      params: dates,
    }
  }
  if (type === 'platform_commission') {
    return {
      sql: `SELECT mt.reference, mt.booking_id AS bookingId,
                   me.delta_kobo AS commissionMinor, mt.currency, mt.created_at AS createdAt
            FROM money_entries me
            JOIN money_accounts ma ON ma.id = me.account_id
            JOIN money_transactions mt ON mt.id = me.transaction_id
            WHERE ma.purpose IN ('platform_commission_revenue','platform_transaction_fee_revenue')
              AND DATE(mt.created_at) BETWEEN ? AND ?
            ORDER BY mt.id`,
      params: dates,
    }
  }
  if (type === 'refunds') {
    return {
      sql: `SELECT rr.internal_reference AS reference, jf.booking_id AS bookingId,
                   jf.client_uid AS clientUid, rr.amount_kobo AS amountMinor,
                   rr.currency, rr.status, rr.provider_refund_reference AS providerReference,
                   rr.reason, rr.created_at AS createdAt, rr.completed_at AS completedAt
            FROM refund_requests rr
            JOIN job_funds jf ON jf.id = rr.job_fund_id
            WHERE DATE(rr.created_at) BETWEEN ? AND ?
            ORDER BY rr.id`,
      params: dates,
    }
  }
  if (type === 'failed_payments') {
    return {
      sql: `SELECT internal_reference AS reference, provider_reference AS providerReference,
                   booking_id AS bookingId, client_uid AS clientUid, amount_kobo AS amountMinor,
                   currency, status, failure_reason AS failureReason, created_at AS createdAt
            FROM marketplace_payment_intents
            WHERE status IN ('failed','cancelled') AND DATE(created_at) BETWEEN ? AND ?
            ORDER BY id`,
      params: dates,
    }
  }
  if (type === 'daily_summary') {
    return {
      sql: `SELECT DATE(created_at) AS transactionDate, transaction_type,
                   COUNT(*) AS transactionCount, SUM(amount_kobo) AS grossAmountMinor,
                   currency
            FROM money_transactions
            WHERE DATE(created_at) BETWEEN ? AND ?
            GROUP BY DATE(created_at), transaction_type, currency
            ORDER BY transactionDate, transaction_type`,
      params: dates,
    }
  }
  return {
    sql: `SELECT ri.id, ri.reconciliation_run_id AS reconciliationRunId,
                 ri.mismatch_type AS mismatchType, ri.severity,
                 ri.internal_reference AS internalReference,
                 ri.provider_reference AS providerReference, ri.user_uid AS userUid,
                 ri.booking_id AS bookingId, ri.expected_amount_kobo AS expectedAmountMinor,
                 ri.actual_amount_kobo AS actualAmountMinor, ri.expected_status AS expectedStatus,
                 ri.actual_status AS actualStatus, ri.status, ri.resolution, ri.created_at AS createdAt
          FROM reconciliation_items ri
          WHERE DATE(ri.created_at) BETWEEN ? AND ?
          ORDER BY ri.id`,
    params: dates,
  }
}

function validDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}
