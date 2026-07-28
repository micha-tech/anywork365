# Wallet overhaul audit

## Current implementation summary

At the start of this audit, Anywork365 was a Next.js 15 application using React 19, TypeScript, MySQL
(`mysql2/promise`), Firebase Authentication and direct REST calls to Paystack.
There is no ORM, queue, background-worker framework, automated test runner or
error-monitoring integration.

The repository currently contains two financial implementations:

1. The deployed legacy implementation uses `wallets`, `wallet_ledger`,
   `wallet_transactions`, `wallet_escrow`, `withdrawal_accounts` and
   `withdrawals`.
2. An uncommitted v2 implementation uses `money_accounts`,
   `money_transactions`, `money_entries`, `funding_intents`,
   `booking_escrows_v2`, `withdrawal_requests_v2` and
   `payment_webhook_events`. Its additive schema is present in the production
   database, but `MONEY_V2_ENABLED` is false.

The production data snapshot taken on 2026-07-28 has no user wallet balances,
payments, locked funds or withdrawals. The v2 ledger has two zero-balance
platform opening accounts and passes reconciliation.

## Existing data model

The legacy model calculates balances by summing mutable decimal ledger rows.
Its transaction table is not connected to each balance entry. Locked booking
funds are stored separately and have no foreign keys.

V2 stores integer kobo entries and an account balance projection. Each business
event has a unique reference and idempotency key. Entries sum to zero, protected
accounts are checked against negative balances, and row locks serialize
spending. V2 currently lacks explicit account classifications, immutable
database triggers, marketplace job-funding intents, pending-earnings holds,
versioned fee rules, a transactional outbox and a reusable command
idempotency record.

## Existing money flows

### Funding

`POST /api/wallet/fund` accepts an arbitrary amount from the browser, initializes
Paystack and creates a general wallet-funding intent. The callback and webhook
can credit general client or artisan available balance.

### Booking payment

`POST /api/bookings` accepts a budget, creates the booking and immediately moves
general client wallet funds into a booking account. This makes funding a wallet
prerequisite instead of collecting money for a specific marketplace
engagement.

### Release and cancellation

`PATCH /api/bookings/:id` releases a confirmed booking when the client marks it
complete, or returns funds when a pending booking is cancelled. V2 posts a
balanced transaction, but earnings become immediately withdrawable and the fee
percentage is a hard-coded constant.

### Withdrawal

`POST /api/wallet/withdraw` reserves v2 funds before calling Paystack and keeps
unknown outcomes reserved for reconciliation. The legacy route also remains
reachable while the feature flag is false.

### Provider events

The webhook verifies Paystack HMAC over the raw body. V2 stores an event hash,
then processes it synchronously. There is no independent worker, dead-letter
state or webhook IP filtering. The redirect callback is a second confirmation
path and relies on the same idempotent settlement operation.

## Components that depend on financial state

- `src/lib/wallet.ts` and wallet helpers in `src/lib/queries.ts`: legacy reads
  and writes.
- `src/lib/money.ts`: v2 account, ledger, funding, booking and withdrawal
  operations.
- `src/lib/paystack.ts`: provider REST calls and webhook HMAC.
- Wallet APIs under `src/app/api/wallet`.
- Booking create/update APIs under `src/app/api/bookings`.
- Admin transaction, wallet, withdrawal, dispute, reconciliation and locked
  funds APIs under `src/app/api/admin`.
- Support user list/detail APIs.
- Client and artisan wallet pages, booking pages and artisan booking modal.
- Admin analytics, disputes and reconciliation pages.
- Notification helpers and `admin_audit_log`.

## Critical vulnerabilities

1. The deployed Git revision still contains the legacy webhook credit path.
   The safer v2 code is local and uncommitted.
2. A live Paystack key is configured while v2 is disabled.
3. General-purpose wallet top-ups are not restricted to marketplace activity.
4. The frontend supplies the funding amount; it is not derived from a job,
   order, milestone or invoice.
5. A hard-coded fee can change the economics of future postings without a
   versioned rule.
6. Released card-funded earnings are immediately withdrawable.
7. NIN presence and an internal `verified` flag are used as withdrawal KYC,
   without a verified KYC profile or risk tier.
8. The shared support account has no individual attribution or MFA.
9. Production reconciliation has no configured secret, scheduler or alerts.
10. `npm audit --omit=dev` reports four high and eight moderate production
    dependency advisories at the audit date.
11. Full database backup and restore have not been demonstrated.

## Double-spending and race-condition risks

Legacy uniqueness is not enforced for provider references, and its check-then-
insert credit path can race across instances. Legacy payout submission has no
persistent submission claim. V2 locks accounts and business records and uses
unique idempotency keys, but needs a general request-hash idempotency mechanism,
a provider submission lease and concurrency tests.

## Balance-integrity risks

Legacy decimal rows and `balance_after` values can diverge. Legacy releases may
credit earnings without proving a corresponding held record. V2 uses balanced
integer entries, but the cached `balance_kobo` field needs database-enforced
immutability of posted entries and reconciliation against Paystack fees and
settlements.

## Webhook-processing risks

The signature check is constant-time and correct, but financial processing is
performed before acknowledgement. Duplicate events are safe only where the
downstream operation has an idempotency key. There is no processing lease,
retry schedule, maximum attempt count, dead-letter queue or operational alert.

## Migration risks

The schema migration is additive and has been rerun idempotently. Legacy money
tables are empty, making cutover low-risk. The remaining risks are traffic
creating new legacy rows before cutover, deploying code separately from the
database flag, and having no staged rollback drill.

## Functionality to preserve

- Authenticated client booking and artisan acceptance.
- Client-controlled completion and booking cancellation rules.
- Paystack collection and transfer rails.
- Verified bank-recipient creation and masked bank display.
- Booking, payment and withdrawal notifications.
- View-only support financial visibility.
- Admin transaction, dispute, withdrawal and reconciliation visibility.
- Existing responsive visual brand and mobile navigation.

## Recommended replacement architecture

Use `money_transactions` and `money_entries` as the immutable authoritative
ledger, with `money_accounts.balance_kobo` only as a locked projection. Add
classified accounts, explicit `job_funds`, pending/held/available artisan
earnings, versioned fee rules, transfer recipients, risk holds, financial audit
records, provider-event processing leases, a transactional outbox and
request-hash idempotency.

External collections must fund a specific booking. Payment confirmation should
move Paystack clearing directly into that booking's locked-funds account.
Completion should move locked funds to pending artisan earnings and platform
revenue. A configurable hold-release worker should make earnings withdrawable.
Withdrawals must reserve available earnings, pass policy/KYC checks, be approved
according to risk configuration and use one persistent Paystack reference.

All legacy write paths should fail closed after cutover and legacy tables should
remain read-only during the verification period.
