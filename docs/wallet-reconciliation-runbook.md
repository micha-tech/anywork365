# Financial reconciliation runbook

## Cadence

- Worker health and dead-letter count: every five minutes.
- Internal ledger invariants and workflow projections: hourly and after each
  deployment.
- Paystack transactions, refunds and transfers: daily.
- Paystack balance/settlement to bank settlement: each settlement day.
- Formal finance sign-off: daily during launch, then at the approved cadence.

## Internal run

Run:

```powershell
npm run finance:v3:reconcile -- --record
```

The command checks journal balance and entry count, cached account projections,
negative protected accounts, locked-job projections, successful
payment-to-ledger links, pending withdrawals, provider dead letters and stale
outbox work. It records the run and itemized exceptions.

An `attention_required` result is a launch blocker. Do not edit an account
balance to clear a mismatch.

## Provider reconciliation

For each internal payment, compare Paystack reference/transaction ID, amount,
currency, environment, customer and final status. For each withdrawal, compare
the same persistent internal reference, transfer code, amount, currency and
final status. For refunds, compare original transaction reference, provider
refund ID, amount and status.

The repository has point-verification operations. A production batch importer
for Paystack transaction, refund, transfer and settlement exports remains an
operations integration requirement.

## Exception handling

1. Assign an owner and severity to every reconciliation item.
2. Stop affected releases or withdrawals if ownership is uncertain.
3. Preserve raw provider events and request IDs.
4. Re-query Paystack using the existing internal reference; never invent a new
   transfer reference for an ambiguous withdrawal.
5. If internal state is wrong, post an approved reversal or typed adjustment.
6. Record the correcting transaction and evidence in the audit log and resolve
   the reconciliation item with a reason.
7. Escalate suspected loss, duplicate movement or unauthorized access under the
   financial incident runbook.

## Daily sign-off

Finance records opening/closing Paystack balance, successful collections,
refunds, transfer principal and fees, Paystack settlements, bank credits,
unsettled amount, internal clearing-account movements, open exceptions and
reviewer names. Engineering supplies worker uptime and dead-letter reports.
