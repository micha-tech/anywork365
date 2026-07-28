# Financial state machines

All transitions are forward-only unless a compensating business event is
explicitly defined. Posted ledger records never change.

## Payment intent

```text
CREATED -> INITIALIZED -> PENDING -> SUCCEEDED
CREATED/INITIALIZED/PENDING -> FAILED | CANCELLED
SUCCEEDED -> PARTIALLY_REFUNDED -> REFUNDED
SUCCEEDED/PARTIALLY_REFUNDED/REFUNDED -> CHARGEBACK
```

Confirmation is idempotent. A duplicate successful event returns the existing
result. Any mismatch in amount, currency, environment, email or metadata fails
closed.

## Job funds

```text
AWAITING_FUNDING -> FUNDING_PENDING -> LOCKED
AWAITING_FUNDING -> CANCELLED
FUNDING_PENDING -> CANCEL_REQUESTED -> LOCKED -> REFUND_PENDING
LOCKED -> RELEASED
LOCKED -> REFUND_PENDING -> REFUNDED
LOCKED/RELEASED/REFUND_PENDING/REFUNDED -> DISPUTED
DISPUTED -> RELEASED | REFUNDED
```

Release and refund are mutually exclusive at the row lock. Released and
refunded amounts are projections checked against the journal.

## Earnings hold

```text
HELD -> RELEASED
HELD -> REVERSED
```

Only the worker may perform scheduled release. A dispute can move pending or
available earnings into a separate risk hold.

## Withdrawal

```text
REQUESTED -> UNDER_REVIEW -> APPROVED -> PROCESSING -> SUCCESS
REQUESTED -> APPROVED
REQUESTED/UNDER_REVIEW/APPROVED -> CANCELLED
PROCESSING -> FAILED | REVERSED
SUCCESS -> REVERSED
FAILED -> APPROVED | CANCELLED
```

In the implementation, a network error after a submission claim returns the
request to `UNDER_REVIEW`; it does not create a second provider request.
`SUCCESS`, `FAILED` and `REVERSED` require Paystack verification.

## Refund

```text
REQUESTED -> PROCESSING -> COMPLETED
PROCESSING -> NEEDS_ATTENTION
PROCESSING/NEEDS_ATTENTION -> FAILED | COMPLETED
REQUESTED -> REJECTED
```

Money remains in client refund-pending while Paystack is non-terminal.
`COMPLETED` clears it externally. `FAILED` moves it to client refundable funds
for an explicit follow-up decision.

## Provider event and outbox

```text
VERIFIED -> PROCESSING -> PROCESSED | IGNORED
PROCESSING -> FAILED -> PROCESSING
FAILED -> DEAD_LETTER

PENDING -> PROCESSING -> DELIVERED
PROCESSING -> FAILED -> PROCESSING
FAILED -> DEAD_LETTER
```

Workers use `FOR UPDATE SKIP LOCKED`, a processing token, attempt counter,
backoff and maximum-attempt policy.
