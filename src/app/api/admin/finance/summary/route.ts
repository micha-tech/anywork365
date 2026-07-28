import { NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { requireFinancialPermission } from '@/lib/financial/admin-permissions'

export async function GET() {
  try {
    const session = await requireAdminApi()
    if (!isMarketplaceFinanceEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Marketplace finance v3 is disabled' },
        { status: 503 }
      )
    }
    await requireFinancialPermission(session.id, 'financial_reports.view')

    const [accounts, jobFunds, withdrawals, refunds, operations, reconciliation] =
      await Promise.all([
        query<(RowDataPacket & {
          classification: string
          purpose: string
          balanceMinor: string | number
        })[]>(
          `SELECT map.classification, ma.purpose, SUM(ma.balance_kobo) AS balanceMinor
           FROM money_accounts ma
           JOIN money_account_policies map ON map.account_id = ma.id
           GROUP BY map.classification, ma.purpose
           ORDER BY map.classification, ma.purpose`
        ),
        query<(RowDataPacket & {
          status: string
          count: number
          amountMinor: string | number
        })[]>(
          `SELECT status, COUNT(*) AS count,
                  COALESCE(SUM(expected_amount_kobo), 0) AS amountMinor
           FROM job_funds GROUP BY status`
        ),
        query<(RowDataPacket & {
          status: string
          count: number
          amountMinor: string | number
        })[]>(
          `SELECT status, COUNT(*) AS count,
                  COALESCE(SUM(amount_kobo), 0) AS amountMinor
           FROM marketplace_withdrawal_requests GROUP BY status`
        ),
        query<(RowDataPacket & {
          status: string
          count: number
          amountMinor: string | number
        })[]>(
          `SELECT status, COUNT(*) AS count,
                  COALESCE(SUM(amount_kobo), 0) AS amountMinor
           FROM refund_requests GROUP BY status`
        ),
        queryOne<(RowDataPacket & {
          providerDeadLetters: number
          staleProviderEvents: number
          outboxDeadLetters: number
          staleOutbox: number
          activeRiskHolds: number
          openDisputes: number
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
               AS openDisputes`
        ),
        queryOne<(RowDataPacket & {
          id: number
          status: string
          issue_count: number
          started_at: Date
          completed_at: Date | null
        })[]>(
          `SELECT id, status, issue_count, started_at, completed_at
           FROM money_reconciliation_runs ORDER BY id DESC LIMIT 1`
        ),
      ])

    return NextResponse.json({
      success: true,
      data: {
        accounts,
        jobFunds,
        withdrawals,
        refunds,
        operations,
        reconciliation,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[ADMIN FINANCE SUMMARY]', error)
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    return NextResponse.json(
      { success: false, error: 'Could not load finance summary' },
      { status: 500 }
    )
  }
}
