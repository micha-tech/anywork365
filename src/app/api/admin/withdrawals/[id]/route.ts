import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized, logAdminAction } from '@/lib/admin'
import { rollbackWithdrawal } from '@/lib/wallet'
import {
  finalizeWithdrawal,
  isMoneyV2Enabled,
  markWithdrawalManualReview,
  markWithdrawalSubmitted,
} from '@/lib/money'
import { verifyTransfer } from '@/lib/paystack'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import {
  approveMarketplaceWithdrawal,
  reconcileMarketplaceWithdrawal,
  submitMarketplaceWithdrawal,
} from '@/lib/financial/withdrawal-service'
import { requireFinancialPermission } from '@/lib/financial/admin-permissions'

type AnyRow = RowDataPacket & Record<string, unknown>

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminApi()
    const { id } = await params

    if (isMarketplaceFinanceEnabled()) {
      const withdrawal = await queryOne<(RowDataPacket & {
        internal_reference: string
        status: string
      })[]>(
        `SELECT internal_reference, status
         FROM marketplace_withdrawal_requests WHERE id = ?`,
        [id]
      )
      if (!withdrawal) {
        return NextResponse.json({ success: false, error: 'Withdrawal not found' }, { status: 404 })
      }
      const body = await request.json()
      if (body.action === 'approve') {
        await requireFinancialPermission(session.id, 'withdrawal.approve')
        if (!body.reason || typeof body.reason !== 'string') {
          return NextResponse.json(
            { success: false, error: 'An approval reason is required' },
            { status: 400 }
          )
        }
        await approveMarketplaceWithdrawal(
          withdrawal.internal_reference,
          { type: 'admin', id: session.id },
          body.reason
        )
        const submitted = await submitMarketplaceWithdrawal(
          withdrawal.internal_reference,
          { type: 'admin', id: session.id }
        )
        await logAdminAction(session.id, 'approve_marketplace_withdrawal', 'withdrawal', id, {
          reference: withdrawal.internal_reference,
          priorStatus: withdrawal.status,
          providerStatus: submitted.status,
          reason: body.reason,
        })
        return NextResponse.json({ success: true, data: submitted })
      }
      if (body.action === 'reconcile') {
        await requireFinancialPermission(session.id, 'withdrawal.reconcile')
        const reconciled = await reconcileMarketplaceWithdrawal(
          withdrawal.internal_reference,
          { type: 'admin', id: session.id }
        )
        await logAdminAction(session.id, 'reconcile_marketplace_withdrawal', 'withdrawal', id, {
          reference: withdrawal.internal_reference,
          priorStatus: withdrawal.status,
          providerStatus: reconciled.status,
        })
        return NextResponse.json({ success: true, data: reconciled })
      }
      return NextResponse.json(
        { success: false, error: 'Allowed actions are approve and reconcile' },
        { status: 400 }
      )
    }

    if (isMoneyV2Enabled()) {
      const withdrawal = await queryOne<(RowDataPacket & {
        reference: string
        status: string
      })[]>(
        'SELECT reference, status FROM withdrawal_requests_v2 WHERE id = ?',
        [id]
      )
      if (!withdrawal) {
        return NextResponse.json({ success: false, error: 'Withdrawal not found' }, { status: 404 })
      }
      const body = await request.json()
      if (body.action !== 'reconcile') {
        return NextResponse.json(
          { success: false, error: 'Money ledger withdrawals can only be reconciled against Paystack.' },
          { status: 400 }
        )
      }
      try {
        const verified = await verifyTransfer(withdrawal.reference)
        const paystackStatus = verified.data.status.toLowerCase()
        if (paystackStatus === 'success' || paystackStatus === 'failed' || paystackStatus === 'reversed') {
          await finalizeWithdrawal({
            reference: withdrawal.reference,
            status: paystackStatus,
            amountKobo: verified.data.amount,
            currency: verified.data.currency,
            domain: verified.data.domain,
            transferCode: verified.data.transfer_code,
          })
        } else {
          await markWithdrawalSubmitted(
            withdrawal.reference,
            verified.data.transfer_code || null,
            paystackStatus
          )
        }
        await logAdminAction(session.id, 'reconcile_withdrawal', 'withdrawal_v2', id, {
          reference: withdrawal.reference,
          priorStatus: withdrawal.status,
          paystackStatus,
        })
        return NextResponse.json({ success: true, data: { status: paystackStatus } })
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Paystack verification failed'
        await markWithdrawalManualReview(withdrawal.reference, reason)
        await logAdminAction(session.id, 'reconcile_withdrawal_failed', 'withdrawal_v2', id, {
          reference: withdrawal.reference,
          reason,
        })
        return NextResponse.json(
          { success: false, error: 'Paystack could not confirm this withdrawal; funds remain reserved.' },
          { status: 409 }
        )
      }
    }

    const withdrawal = await queryOne<AnyRow[]>(
      'SELECT * FROM withdrawals WHERE id = ?', [id]
    )
    if (!withdrawal) {
      return NextResponse.json({ success: false, error: 'Withdrawal not found' }, { status: 404 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'mark_paid') {
      if (withdrawal.status !== 'pending') {
        return NextResponse.json({ success: false, error: 'Only pending withdrawals can be marked paid' }, { status: 409 })
      }
      const result = await execute("UPDATE withdrawals SET status = 'paid' WHERE id = ? AND status = 'pending'", [id])
      if (result.affectedRows === 0) {
        return NextResponse.json({ success: false, error: 'Withdrawal was already updated' }, { status: 409 })
      }
      await logAdminAction(session.id, 'mark_withdrawal_paid', 'withdrawal', id)
    } else if (action === 'mark_failed') {
      if (withdrawal.status !== 'pending') {
        return NextResponse.json({ success: false, error: 'Only pending withdrawals can be marked failed' }, { status: 409 })
      }
      await rollbackWithdrawal(id, body.reason || 'Transfer failed')
      await logAdminAction(session.id, 'mark_withdrawal_failed', 'withdrawal', id, { reason: body.reason })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin withdrawal POST error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
