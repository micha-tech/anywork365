# Wallet and Payment Security Review — 28 August 2026

## Scope

This review covered booking payments, client wallet funding, quote acceptance, Paystack Pay with Transfer, webhook intake and retries, ledger posting, refunds, earnings release, withdrawals, and the database relationships connecting those records.

The production database was inspected with read-only aggregate queries. No customer emails, account numbers, provider payloads, session cookies, or individual balances were printed or changed.

## Production data result

The current financial data reconciled successfully:

- all posted journals are balanced;
- cached account balances match their immutable entries;
- protected accounts have no negative balance;
- no booking payment account is orphaned from its booking, quote, or payment intent;
- no current payment account points to a different booking or client;
- no duplicate Paystack transaction ID was found;
- no succeeded payment is missing its ledger transaction;
- no booking has more than one active transfer account;
- no webhook is stuck or dead-lettered;
- no stale financial outbox item was found.

## Hardening added

### Payment identity and ownership

Every new booking payment now carries the accepted quote ID, job-fund ID, booking ID, client UID, artisan UID, amount, currency, payment-intent ID, request ID, and a one-way session fingerprint through the payment chain. The raw Firebase session credential is never stored.

The complete relationship is checked before calling Paystack and checked again, under database locks, before an account is saved or value is posted to the ledger.

### Provider verification

Successful fulfilment now requires exact matches for:

- Paystack environment and successful status;
- internal/provider reference;
- unique provider transaction ID;
- paid and requested amount in kobo;
- currency and customer email;
- booking, quote, client, payment-intent, and request metadata.

Provider responses also have a 15-second timeout and invalid JSON is treated as a provider failure.

### Webhooks and idempotency

The webhook verifies the HMAC-SHA512 signature against the exact raw body, writes the event durably, and returns promptly. The authenticated worker performs fulfilment. Payload hashes and provider IDs deduplicate delivery, while the ledger's provider-transaction idempotency key prevents duplicate value delivery.

Worker leases abandoned for more than 15 minutes are reclaimable. Dead letters, stale leases, duplicate active transfer accounts, incomplete successful payments, and relational mismatches are now included in scheduled reconciliation.

### Database enforcement

Migration `2026-08-28-payment-integrity-v5` adds composite foreign keys for the quote → job fund → payment intent → payment account chain, unique provider transaction IDs, one payment account per intent, and one active Pay with Transfer account per booking. Historical job funds created before quotes remain marked by a nullable quote link; all new paths supply the link.

## Verification completed

- production read-only reconciliation: passed with zero issues;
- payment-integrity migration preflight: passed with zero conflicts;
- payment-integrity v5 migration: applied to production at 08:06 WAT with checksum `3b794bd9a212b3224dc0ad45a1fc0b78ad29b483a1c289372974ef152109b722`;
- migration postflight: all 7 columns, 6 indexes, 4 relationship constraints, and 2 compatibility triggers present, with zero relationship mismatches;
- financial tests: 15 passed, 1 skipped because no isolated `FINANCIAL_TEST_DATABASE` is configured;
- TypeScript check: passed;
- production Next.js build: passed;
- production dependency audit: zero known vulnerabilities after patched transitive overrides.

## Deployment order

1. Take a database backup.
2. Run `npm run finance:v5:migrate:dry` against the deployment database.
3. Run `npm run finance:v5:migrate` during a short finance maintenance window.
4. Deploy the application code.
5. Run the finance health endpoint or moderation reconciliation and confirm all checks pass.
6. Confirm Vercel production keeps `MARKETPLACE_FINANCE_V3_ENABLED=true`, `PAYSTACK_ENVIRONMENT=live`, `CRON_SECRET`, and `FINANCIAL_WORKER_SECRET` configured.

The application now fails closed in production if marketplace finance v3 is disabled, so it cannot silently fall back to the legacy wallet implementation.

## Production migration record

The pre-migration logical backup is `backups/anywork365-backup-2026-08-28T07-57-30-736Z.sql.gz`. Its manifest records SHA-256 `014645eaa3317d758c682227d61592dcc5992604cf8b3137aade91b9bcce926b`.

The first application attempt exposed an Aiven/MySQL table-rebuild limitation while adding a stored generated column to `booking_payment_accounts`. The migration runner was made resumable, the uniqueness projection was changed to an indexed virtual generated column with equivalent enforcement, and the remaining steps were completed under the finance migration lock. The partial attempt backfilled only the new relationship/audit metadata; it did not change amounts, balances, statuses, ledger entries, or provider records. The final schema postflight and full application reconciliation both passed with zero issues.
