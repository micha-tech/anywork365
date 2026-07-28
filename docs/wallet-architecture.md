# Marketplace finance architecture

## Purpose and boundary

Anywork365 is a marketplace payment system, not a deposit account or
general-purpose money-transfer product. A client payment must identify one
booking. Clients cannot send an arbitrary cash-like balance to another user.
Paystack is the external collection, refund and transfer rail. The internal
ledger is the source of truth for rights and obligations inside Anywork365.

Legacy identifiers containing the term `escrow` describe historical database
objects only. The v3 product and implementation use **locked job funds**,
**pending earnings** and **available earnings**. This wording makes no claim
that Anywork365 provides a regulated escrow service.

```mermaid
flowchart LR
  C["Client booking"] --> PI["Payment intent"]
  PI --> P["Paystack collection"]
  P --> PE["Durable provider event"]
  PE --> W["Financial worker"]
  W --> LF["Locked job funds"]
  LF --> EH["Pending earnings hold"]
  EH --> AE["Available artisan earnings"]
  AE --> WR["Withdrawal reservation"]
  WR --> PT["Paystack transfer"]
  PT --> WE["Withdrawn earnings"]
  W --> OB["Transactional outbox"]
  OB --> N["Notifications"]
```

## Authoritative records

- `money_transactions` is one immutable posted business event.
- `money_entries` is the immutable balanced journal.
- `money_accounts.balance_kobo` is a row-locked performance projection. It is
  checked against entries by reconciliation and is not independent truth.
- `marketplace_payment_intents`, `job_funds`,
  `marketplace_withdrawal_requests`, `refund_requests`,
  `financial_disputes` and `financial_chargebacks` hold workflow state.
- `provider_events` stores signed provider messages before processing.
- `financial_outbox_events` stores post-commit side effects.
- `financial_audit_logs` stores actor, action, resource and reason.

All monetary values are signed or unsigned `BIGINT` minor units as appropriate.
Application money calculations use `bigint`; API boundaries convert to safe
integers only where Paystack requires a JSON number. V3 supports NGN only.

## Account model

Account creation is internal and restricted to the allow-listed constructors in
`src/lib/financial/account-types.ts`. Accounts have an owner, purpose,
currency, classification and negative-balance policy. Client, artisan, booking,
platform and system accounts are separate. Only clearing, suspense, adjustment
and explicitly configured platform reserve accounts may become negative.

The journal uses a signed balance-delta convention: positive entries increase
the account projection and negative entries decrease it. Every posted
transaction must have at least two consolidated accounts and sum to zero.
`ledger_entries_view` exposes positive entries as credits and negative entries
as debits for reporting.

## Service boundaries

- `LedgerService`: the only v3 code allowed to insert entries or change account
  projections.
- Marketplace service: creates booking payment intents, confirms payments,
  locks and releases job funds, and releases matured earnings.
- Withdrawal service: recipient policy, reservations, approvals, provider
  submission claims and terminal posting.
- Refund service: provider submission and terminal refund handling.
- Risk service: dispute holds and chargeback postings.
- Provider event service: durable ingestion leases, retries and dead letters.
- Outbox service: post-commit notification delivery.
- Paystack gateway: normalized provider adapter.

Provider network calls happen outside database transactions. A durable intent,
reservation or claim is committed before the call. Unknown outcomes remain in a
non-spendable state until provider verification or finance review.

## Security and operational controls

- Raw-body HMAC verification precedes event ingestion.
- Payment amount, currency, environment, customer and metadata are verified
  against the internal intent.
- Unique references and request hashes prevent replay with changed parameters.
- Account and workflow rows are locked in deterministic order.
- Posted transactions and entries have database update/delete blockers.
- Full bank numbers are not retained in v3; only the Paystack recipient code
  and last four digits are stored.
- KYC, bank-name matching, bank-change delay, velocity limits and risk holds
  gate withdrawals.
- Admins cannot directly edit balances. Corrections require a typed reversal or
  adjustment operation with an audit reason.

## Availability design

Workers are invoked by a protected scheduler endpoint. Provider events and
outbox messages use leases, bounded exponential retry and dead-letter states.
Reconciliation checks balanced journals, account projections, locked job funds,
payment-to-ledger links, withdrawal reservations and stale work. Alerts must be
configured externally for dead letters, reconciliation failures and worker
silence before production activation.

## Detailed flows

### Funding

```mermaid
sequenceDiagram
  participant C as Client
  participant A as Anywork365
  participant P as Paystack
  C->>A: Create booking
  A->>A: Commit booking + exact payment intent
  A->>P: Initialize same reference and amount
  P-->>C: Secure checkout
  P->>A: Signed charge.success
  A->>A: Store provider event
  A->>P: Verify transaction
  A->>A: Post clearing to locked job funds
```

### Job-fund release

```mermaid
flowchart LR
  L["Locked job funds"] --> C["Client completes confirmed booking"]
  C --> J["Balanced release journal"]
  J --> P["Artisan pending earnings"]
  J --> F["Versioned platform commission"]
  P --> H["Safety hold matures"]
  H --> A["Artisan available earnings"]
```

### Withdrawal

```mermaid
flowchart LR
  A["Available earnings"] --> V["KYC, recipient, limits and risk"]
  V --> R["Reserve to withdrawal pending"]
  R --> Q{"Review required?"}
  Q -->|Yes| M["Finance approval"]
  Q -->|No| S["One-time provider submission claim"]
  M --> S
  S --> P["Paystack transfer"]
  P -->|Success| W["Withdrawn earnings"]
  P -->|Failed or reversed| B["Return to available"]
  P -->|Unknown| X["Remain reserved for reconciliation"]
```

### Refund

```mermaid
flowchart LR
  L["Locked job funds"] --> R["Client refund pending"]
  R --> P["Paystack refund request"]
  P -->|Pending or processing| R
  P -->|Processed| E["External payment clearing"]
  P -->|Failed| C["Client refundable funds and finance review"]
```

### Dispute and chargeback

```mermaid
flowchart LR
  D["Signed dispute event"] --> J["Mark job disputed"]
  J --> H["Move accessible earnings to risk hold"]
  H --> O{"Outcome"}
  O -->|Won| A["Release hold"]
  O -->|Lost| C["Chargeback journal"]
  C --> X["External clearing"]
  C --> R["Consume risk hold / commission / operational reserve"]
```

### Ledger transaction structure

```mermaid
flowchart TD
  T["Immutable money transaction"] --> E1["Entry 1: account + signed minor amount"]
  T --> E2["Entry 2: account + signed minor amount"]
  T --> EN["Optional additional entries"]
  E1 --> I["Same NGN currency; non-zero; consolidated sum = 0"]
  E2 --> I
  EN --> I
  I --> B["Locked account projections updated atomically"]
  I --> AU["Audit log"]
  I --> OB["Outbox event"]
```

### Migration

```mermaid
flowchart LR
  I["Inventory"] --> B["Encrypted backup and restore proof"]
  B --> D["Dry run"]
  D --> S["Additive schema"]
  S --> R["Internal reconciliation"]
  R --> T["Paystack test-mode staging"]
  T --> C["Controlled canary"]
  C --> G["Global activation"]
  G --> L["Legacy writes retired after sign-off"]
```

### Webhook processing

```mermaid
flowchart LR
  W["Raw webhook"] --> S{"Valid HMAC?"}
  S -->|No| X["Reject and monitor"]
  S -->|Yes| D["Durable provider event"]
  D --> A["Immediate 200"]
  D --> C["Worker lease"]
  C --> V["Verify with Paystack"]
  V --> P["Idempotent domain operation"]
  P --> O["Processed"]
  C -->|Transient failure| R["Backoff retry"]
  R -->|Max attempts| DL["Dead letter and alert"]
```

### Reconciliation

```mermaid
flowchart LR
  L["Ledger and projections"] --> R["Reconciliation run"]
  P["Paystack transactions, refunds and transfers"] --> R
  S["Paystack and bank settlements"] --> R
  R --> M{"Mismatch?"}
  M -->|No| G["Finance sign-off"]
  M -->|Yes| I["Itemized exception"]
  I --> V["Investigate existing references"]
  V --> C["Compensating entry if approved"]
  C --> R
```
