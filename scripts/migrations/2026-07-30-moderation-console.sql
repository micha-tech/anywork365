-- Financial Operations Console access.
-- Grants the existing named administrator accounts the complete finance permission set.
-- The shared customer-support account remains excluded because its role is `support`.

INSERT INTO financial_admin_permissions (
  admin_uid,
  permission_code,
  granted_by_uid,
  reason,
  expires_at,
  revoked_at
)
SELECT
  u.uid,
  permissions.permission_code,
  u.uid,
  'Approved full-access Financial Operations Console rollout',
  NULL,
  NULL
FROM users u
CROSS JOIN (
  SELECT 'financial_reports.view' AS permission_code
  UNION ALL SELECT 'withdrawal.approve'
  UNION ALL SELECT 'withdrawal.reconcile'
  UNION ALL SELECT 'dispute.chargeback'
  UNION ALL SELECT 'refund.manage'
  UNION ALL SELECT 'risk_hold.manage'
  UNION ALL SELECT 'adjustment.create'
  UNION ALL SELECT 'reconciliation.run'
) permissions
WHERE u.role = 'admin' AND u.deleted = 0
ON DUPLICATE KEY UPDATE
  granted_by_uid = VALUES(granted_by_uid),
  reason = VALUES(reason),
  expires_at = NULL,
  revoked_at = NULL;
