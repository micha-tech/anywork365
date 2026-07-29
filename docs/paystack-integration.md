# Paystack integration

## Responsibilities

Paystack provides collection checkout, account resolution, transfer-recipient
creation, transfers, refunds and provider status. Anywork365 owns booking
authorization, internal references, ledger postings, spendability, risk,
reconciliation and customer-visible states.

All provider access goes through `PaymentRail` and `PaystackGateway`. Secret keys
remain server-side. The configured environment must match every verified
transaction, transfer and refund event.

## Collections

The server creates an exact wallet-funding intent before calling Paystack.
Metadata includes `type=wallet_funding`, client UID, funding-intent ID and the
intended wallet credit. The callback is a user-experience confirmation path;
signed webhooks are the durable asynchronous path. Both converge on the same
idempotent provider verification and ledger operation.

The verifier requires a successful, environment-matched NGN transaction and
an exact match for reference, requested amount, email and metadata. A unique
Paystack transaction ID is the credit idempotency key. The receipt and client
wallet credit are written atomically. The amount credited is the intended
funding amount; Paystack's verified processing fee is posted separately.

Bookings do not create new Paystack charges. A booking atomically locks the
server-priced amount from the client's verified wallet balance.

## Webhooks

Configure `/api/wallet/webhook` as the Paystack webhook URL. The handler reads
the raw body, verifies `x-paystack-signature`, stores the event hash and payload,
and acknowledges. The protected worker processes:

- `charge.success`
- `transfer.success`, `transfer.failed`, `transfer.reversed`
- `refund.pending`, `refund.processing`, `refund.needs-attention`,
  `refund.failed`, `refund.processed`
- `charge.dispute.create`

Unknown signed events are retained and marked ignored. Repeated failures enter
dead letter after `WEBHOOK_MAX_ATTEMPTS`.

## Transfers

The app creates a persistent, 16–50 character internal reference before
submitting a transfer. Paystack recipient code and masked bank details are
stored. A submission attempt is claimed in the database first. Webhooks are
preferred for terminal status; admin reconciliation uses Paystack’s verify
transfer endpoint with the same reference. The terminal verification response's
`fee_charged` is recorded as a platform expense without reducing the artisan's
withdrawal principal.

Do not enable automatic transfers until the Paystack business is eligible,
transfer balance/fees are funded, webhook delivery is verified, and the chosen
OTP or approval configuration matches the operating model.

## Refunds

Refund creation uses the original successful Paystack transaction ID/reference
and exact amount. Non-terminal states retain the client refund-pending balance.
`needs-attention` requires a finance workflow and customer bank details; this
retry UI/API is not implemented and is a launch-gate decision.

## Required dashboard configuration

- Correct live API keys in the production secret manager.
- Production webhook URL over HTTPS.
- Transfer approval mode matching `WITHDRAWAL_MODE`.
- Registered-business transfer eligibility.
- Sufficient Paystack transfer/refund balance and alerting.
- Restricted dashboard roles and MFA.
- Settlement bank account verified by finance.

References: [Paystack webhooks](https://paystack.com/docs/payments/webhooks/),
[payment verification](https://paystack.com/docs/payments/verify-payments/),
[single transfers](https://paystack.com/docs/transfers/single-transfers/), and
[refunds](https://paystack.com/docs/payments/refunds/).
