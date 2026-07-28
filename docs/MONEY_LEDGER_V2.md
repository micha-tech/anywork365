# Anywork365 money ledger v2

The application owns the wallet ledger. Paystack is used only to collect external
funding and to move withdrawals to Nigerian bank accounts. Client-to-artisan
payments remain internal: available balance moves to booking escrow, then to the
artisan and the platform fee when the client closes the booking.

## Safety model

- Every amount is stored as integer kobo.
- Every posted transaction has two or more entries whose deltas sum to zero.
- Available, escrow, reserved-withdrawal, fee, and chargeback-reserve accounts
  cannot become negative.
- Funding is credited only after exact reference, amount, currency, email,
  metadata user, and Paystack live/test mode validation.
- Withdrawals move funds into a reserved account before calling Paystack.
  Ambiguous responses never refund or resubmit automatically.
- Webhooks use Paystack's HMAC signature and are retained in a durable inbox.
- Idempotency keys prevent duplicate funding, booking, and withdrawal postings.
- New bank accounts require verified identity, profile-name matching, and a
  24-hour cooling-off period before withdrawal.
- Support access remains view-only. Only administrators can request a Paystack
  reconciliation, and no administrator can directly set a v2 balance or payout
  status.

## Deployment order

Keep `MONEY_V2_ENABLED=false` throughout preparation.

1. Back up the production database with `npm run backup`.
2. Run the read-only legacy checks with `npm run money:preflight`. Do not
   continue unless the result is `ready`.
3. Apply `scripts/migrations/2026-07-29-money-ledger-v2.sql` through the managed
   database console in a maintenance window.
4. Run `npm run money:import:dry` and review all totals.
5. Run `npm run money:import` once the dry-run totals match the legacy ledger.
6. Run `npm run money:reconcile`; all hard checks must pass.
7. Configure a random `RECONCILIATION_SECRET` of at least 32 characters and
   schedule `POST /api/wallet/reconcile` with `Authorization: Bearer <secret>`
   every five minutes.
8. Deploy the application with `MONEY_V2_ENABLED=true`.
9. Test a low-value live funding, booking hold/release/refund, and withdrawal,
   then run reconciliation again.

The schema and import are additive. Do not delete the legacy money tables during
the initial rollout; retain them read-only for audit and rollback analysis.

## Operational alerts

Alert immediately on an unbalanced transaction, stored/calculated balance
mismatch, negative protected account, held escrow on a terminal booking,
withdrawal reserve mismatch, failed webhook, or any manual-review withdrawal.
Account freezes and disputes require a documented administrator review.

Paystack references:

- https://paystack.com/docs/api/transaction/
- https://paystack.com/docs/api/transfer/
- https://paystack.com/docs/payments/webhooks/
- https://paystack.com/docs/api/transfer-control/
