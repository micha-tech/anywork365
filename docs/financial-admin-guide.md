# Financial admin guide

## Financial Operations Console

Named administrators use `/moderation` for financial oversight and controlled
operations. The console includes the Paystack transfer balance, liability
accounts, ledger journal, job funds, withdrawals, refunds, provider disputes,
customer lookup, reconciliation and immutable audit history.

Every money-changing action requires:

- an active, narrowly scoped `financial_admin_permissions` grant;
- an attributable administrator session;
- an incident or support ticket;
- a written operational reason;
- a typed confirmation phrase; and
- the existing idempotent financial service for the requested operation.

The console never edits balances directly. Withdrawal cancellation is available
only before a Paystack transfer exists, refund completion remains dependent on a
verified provider outcome, and a successful transfer cannot be returned by
changing the internal ledger.

## Principles

The finance console is for investigation, approval and reconciliation. It is
not a balance editor. Support access is view-only. Shared support credentials
must be replaced with individual identities, MFA and attributable audit actors
before handling production financial data.

V3 finance endpoints also require an active row in
`financial_admin_permissions`; the general `admin` role alone is insufficient.
Permissions are narrowly scoped to reports, withdrawal approval/reconciliation,
chargebacks, refunds, risk holds and adjustments. Grants require a grantor,
reason and optional expiry, and should be provisioned only through an approved
access-management change.

## Daily review

- Worker last-success time and provider-event dead letters.
- Failed/stale outbox events.
- Reconciliation status and open items.
- Withdrawals under review or processing beyond SLA.
- Refunds needing attention or processing beyond SLA.
- Open disputes, risk holds and chargebacks.
- Locked job funds with inconsistent booking status.
- Paystack balance, transfer funding and settlement exceptions.

## Withdrawal actions

`approve` requires a written reason and changes the request from review to
approved before a one-time provider submission claim. `reconcile` verifies the
existing reference with Paystack. A v3 request cannot be manually marked paid.
If Paystack is inconclusive, leave funds reserved and escalate.

## Refund and dispute actions

A refund requiring attention must be investigated in Paystack and through the
customer support identity-verification procedure. The repository does not yet
provide the Paystack retry-with-customer-details admin form.

For a dispute, review the original booking, payment verification, completion,
messages, uploaded evidence and risk hold. Chargeback recording must use the
typed chargeback operation and an attributable finance actor.

## Prohibited actions

- Direct SQL changes to balances, transactions or entries.
- Deleting provider events or financial audit history.
- Reusing a new Paystack reference for an uncertain transfer.
- Enabling the v3 flag before migration, worker and reconciliation gates.
- Exposing full bank details, API keys or raw sensitive provider payloads to
  support staff.
- Treating cached dashboard totals as a substitute for reconciliation.

Exceptional adjustments require `adjustment.create`, a support/incident ticket,
a detailed reason and a unique idempotency key. They post a balanced journal
against the system adjustment account and create both financial and admin audit
records. They must not be used to conceal or rewrite an incorrect historical
transaction.
