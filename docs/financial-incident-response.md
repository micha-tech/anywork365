# Financial incident response

## Severity

- **SEV-1:** duplicate or unauthorized movement, ledger imbalance, suspected key
  compromise, widespread incorrect balances, or material provider mismatch.
- **SEV-2:** stuck withdrawals/refunds, worker outage, dead-letter growth or
  isolated reconciliation mismatch with funds safely reserved.
- **SEV-3:** delayed notification/reporting with correct financial state.

## First 15 minutes

1. Name incident commander, finance lead, engineering lead and scribe.
2. Disable new v3 financial commands if integrity is uncertain. Preserve signed
   webhook ingestion where safe.
3. Do not switch writes to legacy tables and do not delete or edit posted
   records.
4. Preserve logs, provider events, references, audit rows, deployment SHA and
   configuration version.
5. Run internal reconciliation without mutating state.
6. Restrict Paystack dashboard/API access if credentials may be compromised.

## Investigation

Trace one internal reference across payment intent, provider event, job funds,
ledger transaction/entries, outbox, refund/withdrawal and audit log. Compare
amount, currency, environment, customer, booking and provider IDs. Determine
whether the provider outcome is final, pending or unknown.

For ambiguous transfers, verify the existing reference. Never send a new
transfer. For duplicate provider messages, prove the downstream idempotency
record and one posted transaction. For a ledger mismatch, identify the earliest
divergent entry and projection; do not repair the projection by hand.

## Containment and correction

- Revoke/rotate keys and worker secrets through the secret manager.
- Pause affected workers or command routes with the feature flag.
- Place targeted risk holds where customer or artisan funds could move.
- Correct financial truth using an approved compensating transaction.
- Record actor, reason, evidence and linked incident in the audit log.
- Re-run internal and provider reconciliation before restoring commands.

## Communication and closure

Legal/compliance determines regulatory or customer notification. Support gets a
fact-based script that avoids unverified timelines. The post-incident review
must include financial impact, root cause, detection gap, exact references,
corrective entries, control owners and deadlines. Finance and engineering sign
the final reconciliation before closure.
