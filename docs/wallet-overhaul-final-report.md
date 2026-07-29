# Marketplace finance overhaul final report

Date: 2026-07-28  
Implementation status: code complete behind a disabled v3 feature flag; not
approved for production activation.

## Wallet funding v4 update — 2026-07-29

This update supersedes the earlier direct-per-booking collection rule while
preserving the rule against arbitrary user-to-user transfers.

- Clients can fund only their own wallet through a persisted Paystack intent.
- Callback and signed webhook processing converge on exact provider
  verification and one idempotent ledger credit.
- A unique provider transaction ID, receipt and ledger transaction are required
  for every succeeded funding intent. The requested amount is credited; the
  charged amount and Paystack fee are recorded separately.
- Booking creation atomically locks its server-priced amount from verified
  client wallet funds. It does not make a second Paystack charge.
- Cancellation before release atomically returns locked funds to the client
  wallet. Client completion releases the booking-specific lock to artisan
  pending earnings and versioned platform revenue.
- Artisan release validates the job lock and verifies that cumulative released
  wallet-funded jobs do not exceed succeeded Paystack funding receipts with
  provider transaction IDs.
- Withdrawal completion still requires terminal Paystack verification. The
  verified transfer fee is recorded as a platform expense while the artisan
  receives the requested principal.
- `2026-07-29-wallet-funding-v4.sql` is additive and requires the v3 schema.
  The configured database currently has neither v3 nor v4 installed, and the
  global finance flag remains disabled.
- Current verification: type-check passed, financial tests 9 passed/1 skipped,
  production build passed, full dependency audit reports zero vulnerabilities.

## 1. Architecture implemented

The repository now contains an NGN-only, integer-minor-unit, immutable
double-entry marketplace ledger. External collection is tied to a server-created
booking payment intent. Successful verification moves provider clearing into
locked job funds. Booking completion separates versioned platform commission
from artisan pending earnings, which mature into available earnings through a
worker. Withdrawals reserve only available earnings and use one persistent
Paystack reference.

Provider events are verified over the raw body, stored before processing, leased
by a retryable worker and dead-lettered after bounded attempts. Financial
postings write audit and transactional-outbox records in the same transaction.
Refund, dispute, risk-hold, chargeback, adjustment and reconciliation models are
included.

## 2. Files created

- `src/lib/financial/`: money primitives, account registry, ledger/invariants,
  configuration, state machines, idempotency, Paystack adapter, marketplace,
  withdrawal, refund, risk, adjustment, provider-event and outbox services.
- `scripts/migrations/2026-07-29-marketplace-finance-v3.sql`
- `scripts/migrate-marketplace-finance-v3.mjs`
- `scripts/reconcile-marketplace-finance-v3.mjs`
- `src/app/api/wallet/workers/route.ts`
- `src/app/api/admin/finance/`: summary, reports, adjustments and dispute
  chargeback operations.
- `tests/financial/`: unit, property, state-machine and optional isolated-MySQL
  concurrency tests.
- All required wallet architecture, business, state-machine, migration,
  reconciliation, Paystack, incident, admin and audit documents.

The working tree also contains the previously implemented v2 ledger, migration,
clear-data backup and reconciliation files. No commit was created.

## 3. Files modified

Booking create/update, wallet funding/verification/webhook/withdrawal/recipient
routes, wallet UI, artisan booking UI, support visibility, admin transactions,
admin withdrawals/stats, Paystack client, environment example, TypeScript target
and package scripts were updated.

Legacy financial code remains available only for rollback while v3 is disabled.
V3 branches do not call legacy balance writers. General funding returns HTTP 410
when v3 is enabled, and the wallet UI no longer offers a general add-money
action.

## 4. Database migrations

V2 was previously applied and reconciled. V3 is an additive migration defining
classified account policy, versioned fees, idempotency, job funds, payment
intents, provider events, recipients, withdrawals, earnings/risk holds, refunds,
disputes, chargebacks, KYC projection, audit, outbox, notifications, finance
permissions, adjustments, reconciliation items, limits, reporting view and
immutability triggers.

V3 dry run passed against the configured database prerequisites with checksum:

```text
c1fd5419bcaa3e8499e68799034eb5ddf07fe47211bd5190014d91ab93294096
```

No v3 schema was applied to production. This is intentional: no staging
database, restore rehearsal or separate integration-test database was supplied.

## 5. Business rules implemented

- Booking-specific payment only; no unrestricted P2P or cash-like top-up.
- Exact server-authoritative amount and NGN.
- Versioned integer basis-point commission.
- Locked, pending, available, withdrawing, withdrawn, refundable and risk-held
  states.
- Late payment after cancellation is collected into locked funds and
  immediately enters the refund workflow rather than being orphaned.
- Client-controlled completion and booking-party cancellation authorization.
- Configurable earnings hold, withdrawal limits, approval mode and risk
  threshold.
- Provider-terminal status required for withdrawal/refund finalization.
- Provider ambiguity stays reserved for reconciliation.

## 6. Security controls implemented

- Raw-body constant-time Paystack HMAC verification.
- Provider amount, currency, environment, email, metadata and ownership checks.
- Unique internal/provider references and request-hash idempotency conflict
  detection.
- Deterministic account locks, protected nonnegative balances and immutable
  posted records.
- No v3 storage of full bank account numbers.
- Identity/NIN gate, bank-name match, bank-change hold, velocity limits and risk
  holds.
- One-time transfer submission claim.
- Read-only support views and disabled direct admin balance edits.
- Separate finance permissions; general admin role alone cannot approve,
  reconcile, report, charge back or adjust.
- Typed, balanced, reason/ticket-based exceptional adjustment operation.

## 7. Tests added

- Exact major/minor conversion and invalid precision.
- Integer fee rounding, cap/minimum and 2,000 generated property cases.
- Balanced journal, entry count, consolidation, zero and mixed-currency
  invariants.
- Payment, job-fund and withdrawal state transitions.
- Isolated MySQL concurrent reservation test using two connections and row
  locks.

## 8. Test results

```text
TypeScript: passed
Financial tests: 9 passed, 0 failed, 1 skipped
Next.js production build: passed
V3 migration dry run: passed
git diff --check: passed
```

The skipped test is the real MySQL concurrency test because
`FINANCIAL_TEST_DATABASE` is not configured. The production build completed
with existing lint warnings, not build errors.

`npm audit --omit=dev` reports 4 high and 8 moderate dependency
vulnerabilities. The suggested full fix includes breaking Next.js/Firebase
changes, so it was not applied without a dedicated upgrade and regression
cycle.

## 9. Migration approach

Use additive installation, disabled deploy, internal reconciliation, Paystack
test-mode staging, isolated concurrency/E2E tests, controlled canary and global
activation. Legacy financial writes must not be re-enabled after v3 money
exists. Posted records are corrected only by compensating transactions.

## 10. Remaining risks

- V3 has not been installed or exercised against a staging MySQL instance.
- No live/test Paystack end-to-end webhook, refund, transfer or settlement
  rehearsal was performed.
- Provider/bank settlement batch import is still an operational integration;
  point verification and internal reconciliation are implemented.
- Refund `needs-attention` has a safe review state but no admin UI for Paystack
  retry-with-customer-bank-details.
- The feature flag is global; a per-user/percentage canary flag is recommended.
- The current identity flag plus NIN is an interim withdrawal gate, not a full
  KYC/AML program.
- Alert delivery and error monitoring are not connected.
- The shared support login lacks individual attribution and must not receive
  finance permissions.
- Dependency advisories require a separate upgrade.
- Production configuration lacks `FINANCIAL_WORKER_SECRET`; local environment
  precedence also contains a localhost app URL and must be corrected in the
  deployment secret manager.

## 11. Required environment variables

See `.env.example`. Required for v3 are Paystack secret/public keys, base URL,
environment, signature configuration, `FINANCIAL_WORKER_SECRET`, NGN currency,
withdrawal limits/holds/mode, fee rule, reconciliation schedule, webhook
attempts, retention days and the disabled-by-default
`MARKETPLACE_FINANCE_V3_ENABLED` flag.

## 12. Required Paystack dashboard configuration

- Live HTTPS webhook URL and verified test delivery.
- Correct test/live keys in separate secret stores.
- Registered-business transfer access and funded transfer/refund balance.
- Transfer approval/OTP mode matching the chosen operating procedure.
- Finance-only dashboard roles, MFA and settlement-bank verification.
- Alerts for transfer balance, webhook failures, refunds and disputes.

## 13. Required operational procedures

Schedule `/api/wallet/workers` with its bearer secret, schedule internal
reconciliation, perform daily provider/settlement sign-off, monitor dead letters
and stale work, provision named finance permissions, rehearse incident response,
and retain encrypted recoverable backups.

## 14. Required legal or compliance confirmation

Nigerian counsel/compliance must approve product characterization, custody and
fund-flow terms, KYC/AML tiers, sanctions/fraud monitoring, consumer disclosures,
refund/dispute SLAs, fee/tax treatment, privacy/retention and incident reporting.
The product wording deliberately uses locked job funds and earnings states and
does not claim a regulated escrow service.

## 15. Deployment checklist

- [ ] Review and commit the working tree.
- [ ] Resolve/accept dependency advisories.
- [ ] Provision staging database and Paystack test configuration.
- [ ] Restore backup in staging and apply v3 migration.
- [ ] Run all tests with `FINANCIAL_TEST_DATABASE`.
- [ ] Complete payment/duplicate/release/withdrawal/refund/dispute E2E matrix.
- [ ] Configure worker, alerts and reconciliation schedules.
- [ ] Provision named finance permissions; remove shared finance access.
- [ ] Record business, finance, security and compliance approvals.
- [ ] Back up production and prove restore.
- [ ] Deploy v3 disabled; apply migration; reconcile.
- [ ] Canary, reconcile and observe before global activation.

## 16. Rollback checklist

- [ ] Before v3 activity, disable the flag and roll back application code.
- [ ] After v3 activity, disable new commands but keep safe event ingestion.
- [ ] Never route v3 users back to legacy writers.
- [ ] Reconcile existing references with Paystack.
- [ ] Preserve all ledger, event and audit records.
- [ ] Use approved reversals/adjustments, never direct balance SQL.
- [ ] Restore service only after finance and engineering sign-off.

## Terminal summary

```text
IMPLEMENTED: v3 application architecture and safe disabled feature path
TESTED: type-check, pure financial suite, production build, migration dry run
MIGRATION READY: additive/checksummed; requires staging rehearsal before apply
REQUIRES BUSINESS DECISION: fees, holds, limits, refundable-fund reuse, canary
REQUIRES PAYSTACK CONFIGURATION: webhook, transfers, secrets, balance, MFA
REQUIRES COMPLIANCE CONFIRMATION: custody characterization, KYC/AML, tax, terms
```
