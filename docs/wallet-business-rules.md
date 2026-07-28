# Marketplace finance business rules

## Product rules

1. A client pays for a specific booking at the price stored by the server.
2. General wallet top-ups and unrestricted user-to-user transfers are disabled
   in v3.
3. A payment is usable only after Paystack verification matches reference,
   amount, NGN currency, environment, customer email and booking metadata.
4. Successfully collected money becomes locked job funds.
5. Only the client can complete a confirmed booking. Completion releases the
   job funds into artisan pending earnings and platform commission.
6. Pending earnings are not spendable or withdrawable. The default safety hold
   is 72 hours.
7. A worker moves matured pending earnings to available earnings exactly once.
8. Cancellation before successful payment cancels the intent. Cancellation
   after payment reserves a provider refund.
9. A provider refund remains pending until a terminal Paystack event. A failed
   refund becomes a client refundable amount requiring finance resolution.
10. A dispute makes job funds disputed and moves accessible artisan earnings
    into a non-withdrawable risk-hold account where possible.

## Fee rules

Fees are evaluated from a versioned `platform_fee_rules` row when job funding is
created. The selected rule and calculated fee are stored with the job. Later
rule changes do not change existing jobs. Calculation uses integer basis points
with half-up rounding, then optional minimum and maximum caps.

The seeded placeholder rule is 500 basis points (5%). Finance and legal owners
must approve the commercial fee, tax treatment and customer disclosures before
activation.

## Withdrawal rules

- Artisan role, existing identity verification and NIN are required.
- The verified bank name must match the verified profile.
- The active Paystack recipient must be at least the configured bank-change
  hold age.
- Only available artisan earnings can be reserved.
- Active risk holds block withdrawals.
- Minimum, maximum, daily and monthly limits are enforced in NGN.
- `MANUAL`, `AUTOMATIC` and `RISK_BASED` approval modes are supported.
- In risk-based mode, amounts above the automatic threshold enter review.
- A unique idempotency key is mandatory. Reuse with different parameters is a
  conflict.
- Provider submission is claimed once before the network call. Ambiguous
  failures remain reserved and require reconciliation; they are neither
  automatically resent nor returned.
- Only verified terminal provider status moves pending withdrawal funds to
  withdrawn earnings or back to available earnings.

## Authorization

- A booking party may cancel a pending booking.
- The artisan may confirm a funded booking.
- The paying client may mark a confirmed booking complete.
- Finance admins may approve or reconcile withdrawals, but cannot mark a v3
  transfer paid manually.
- Support staff have read-only financial visibility.
- Balance adjustments are disabled in the finance API.

## Decisions required before launch

- Confirm the legal characterization of client collections and job-fund
  locking in Nigeria.
- Confirm whether client refundable amounts may be reused for a later booking
  or must always be returned externally. The current UI offers no cash-like
  withdrawal or transfer.
- Approve hold duration, fee rate/caps, withdrawal limits and review threshold.
- Define KYC tiers and evidence; the existing `verified` plus NIN check is an
  interim gate, not a complete compliance program.
- Approve dispute-loss allocation, tax/VAT accounting and record retention.
- Confirm customer terms, consent, refund timelines and support scripts.
