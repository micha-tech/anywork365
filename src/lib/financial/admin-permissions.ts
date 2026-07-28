import { queryOne } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { FinancialError } from './errors'

export type FinancialPermission =
  | 'financial_reports.view'
  | 'withdrawal.approve'
  | 'withdrawal.reconcile'
  | 'dispute.chargeback'
  | 'refund.manage'
  | 'risk_hold.manage'
  | 'adjustment.create'

export async function requireFinancialPermission(
  adminUid: string,
  permission: FinancialPermission
): Promise<void> {
  const row = await queryOne<(RowDataPacket & { allowed: number })[]>(
    `SELECT 1 AS allowed FROM financial_admin_permissions
     WHERE BINARY admin_uid = BINARY ? AND permission_code = ?
       AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [adminUid, permission]
  )
  if (!row) {
    throw new FinancialError(
      'NOT_AUTHORIZED',
      `Financial permission required: ${permission}`,
      403
    )
  }
}
