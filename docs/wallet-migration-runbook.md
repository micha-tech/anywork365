# Marketplace finance migration runbook

## Current status

The v2 additive ledger migration is installed in production and reconciles with
zero user money. The v3 migration is implemented and dry-run validated but is
not applied. `MARKETPLACE_FINANCE_V3_ENABLED` must remain `false` until this
runbook is approved and completed.

## Preconditions

- Approved maintenance/change window and named rollback owner.
- Encrypted, restorable production database backup.
- Deployment artifact built from the reviewed commit.
- Staging uses Paystack test keys and a separate MySQL database.
- Worker scheduler, alerts and secrets are configured.
- No unresolved legacy, v2 or provider reconciliation items.
- Finance, support, engineering, security and compliance sign-off.

## Staging rehearsal

1. Restore a sanitized recent production snapshot to staging.
2. Set both finance feature flags false.
3. Run `npm run finance:v3:migrate:dry`.
4. Apply with `npm run finance:v3:migrate`.
5. Run `npm run finance:v3:reconcile -- --record`.
6. Exercise payment, duplicate event, release, hold maturation, withdrawal,
   failed transfer, refund, dispute and chargeback scenarios with Paystack test
   mode.
7. Run the database concurrency suite with
   `FINANCIAL_TEST_DATABASE=<isolated_database> npm run test:financial`.
8. Repeat the migration to prove checksum/idempotency behavior.
9. Measure worker latency and practice dead-letter recovery.

## Production installation

1. Freeze financial writes at the application edge.
2. Confirm legacy and v2 counts, sums and provider-pending work.
3. Take and verify an encrypted backup; record its identifier outside the
   database.
4. Deploy code with v3 disabled.
5. Run the migration dry run, review checksum, then apply the migration.
6. Run and record v2 and v3 reconciliation.
7. Start the protected worker scheduler while v3 remains disabled only after
   verifying it correctly returns a disabled response.
8. Provision named, MFA-protected finance admins with only the required
   `financial_admin_permissions`; do not grant permissions to the shared support
   account.
9. Enable v3 for internal canary accounts in a future per-user flag or brief
   controlled window. The repository currently has a global flag, so a
   per-user canary mechanism is still recommended before broad activation.
10. Monitor every canary payment through job lock, release and provider records.
11. Enable v3 globally only if all gates are green.

## Rollback

- Before any v3 payment is accepted: set the v3 flag false and roll back the
  application deployment. Leave additive tables in place.
- After v3 financial activity: do not switch writers back to legacy tables.
  Disable new financial commands, keep webhook ingestion available, reconcile
  provider activity, and deploy a forward fix.
- Never delete posted v3 transactions or entries. Corrections use reversal
  transactions.
- Do not drop v3 tables during incident response. Schema removal is a separate
  audited change after retention and legal approval.

## Legacy retirement

After at least two completed settlement cycles and a signed reconciliation
period, remove legacy write code in a separate release. Preserve historical
tables read-only for the approved retention period. Exact historical opening
entries are required if production contains balances at cutover; the current
snapshot is zero, but that must be rechecked immediately before activation.
