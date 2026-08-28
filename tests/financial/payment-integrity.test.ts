import assert from 'node:assert/strict'
import test from 'node:test'
import { FinancialError } from '../../src/lib/financial/errors'
import {
  assertMarketplacePaymentLink,
  assertMarketplaceProviderPayment,
  type MarketplacePaymentLink,
} from '../../src/lib/financial/payment-integrity'
import type { PaymentVerificationResult } from '../../src/lib/financial/payment-rail'

function link(): MarketplacePaymentLink {
  return {
    intent: {
      id: 31,
      internalReference: 'job-pwt-reference',
      bookingId: 12,
      jobFundId: 21,
      quoteId: 8,
      clientUid: 'client-1',
      customerEmail: 'client@example.com',
      amountMinor: BigInt(250_000),
      currency: 'NGN',
      provider: 'paystack',
      providerReference: 'job-pwt-reference',
      requestId: 'b173e812-2644-4707-ad1b-37f7db434726',
      sessionFingerprint: 'a'.repeat(64),
    },
    jobFund: {
      id: 21,
      bookingId: 12,
      quoteId: 8,
      clientUid: 'client-1',
      artisanUid: 'artisan-1',
      amountMinor: BigInt(250_000),
      currency: 'NGN',
    },
    quote: {
      id: 8,
      bookingId: 12,
      artisanUid: 'artisan-1',
      amountMinor: BigInt(250_000),
      status: 'accepted',
    },
    booking: {
      id: 12,
      clientUid: 'client-1',
      artisanUid: 'artisan-1',
      amountMinor: BigInt(250_000),
      status: 'Awaiting Payment',
    },
    account: {
      paymentIntentId: 31,
      bookingId: 12,
      quoteId: 8,
      clientUid: 'client-1',
      amountMinor: BigInt(250_000),
      currency: 'NGN',
      provider: 'paystack',
      providerReference: 'job-pwt-reference',
      status: 'active',
    },
  }
}

function verification(): PaymentVerificationResult {
  return {
    provider: 'paystack',
    reference: 'job-pwt-reference',
    providerTransactionId: '998877',
    amountMinor: 250_000,
    requestedAmountMinor: 250_000,
    providerFeeMinor: 3_750,
    currency: 'NGN',
    environment: 'live',
    status: 'succeeded',
    customerEmail: 'client@example.com',
    paymentMethod: 'bank_transfer',
    gatewayResponse: 'Successful',
    paidAt: '2026-08-28T08:00:00.000Z',
    metadata: {
      type: 'booking_funding',
      bookingId: '12',
      quoteId: '8',
      clientUid: 'client-1',
      paymentIntentId: '31',
      requestId: 'b173e812-2644-4707-ad1b-37f7db434726',
    },
  }
}

function expectFinancialFailure(run: () => void): void {
  assert.throws(run, (error: unknown) => error instanceof FinancialError)
}

test('accepts a complete quote-to-provider payment chain', () => {
  const context = link()
  assert.doesNotThrow(() =>
    assertMarketplacePaymentLink(context, { requirePaymentAccount: true })
  )
  assert.doesNotThrow(() => assertMarketplaceProviderPayment(context, verification()))
})

test('rejects cross-booking, cross-client, cross-artisan and amount tampering', () => {
  const cases: MarketplacePaymentLink[] = []
  const wrongBooking = link()
  wrongBooking.account!.bookingId = 99
  cases.push(wrongBooking)
  const wrongClient = link()
  wrongClient.jobFund.clientUid = 'client-2'
  cases.push(wrongClient)
  const wrongArtisan = link()
  wrongArtisan.quote.artisanUid = 'artisan-2'
  cases.push(wrongArtisan)
  const wrongAmount = link()
  wrongAmount.quote.amountMinor = BigInt(1)
  cases.push(wrongAmount)
  const rejectedQuote = link()
  rejectedQuote.quote.status = 'rejected'
  cases.push(rejectedQuote)

  for (const context of cases) {
    expectFinancialFailure(() =>
      assertMarketplacePaymentLink(context, { requirePaymentAccount: true })
    )
  }
})

test('rejects provider reference, transaction metadata and requested amount tampering', () => {
  const wrongReference = verification()
  wrongReference.reference = 'another-reference'
  expectFinancialFailure(() => assertMarketplaceProviderPayment(link(), wrongReference))

  const wrongQuote = verification()
  wrongQuote.metadata.quoteId = '99'
  expectFinancialFailure(() => assertMarketplaceProviderPayment(link(), wrongQuote))

  const wrongIntent = verification()
  wrongIntent.metadata.paymentIntentId = '32'
  expectFinancialFailure(() => assertMarketplaceProviderPayment(link(), wrongIntent))

  const wrongRequest = verification()
  wrongRequest.metadata.requestId = 'another-request'
  expectFinancialFailure(() => assertMarketplaceProviderPayment(link(), wrongRequest))

  const wrongRequestedAmount = verification()
  wrongRequestedAmount.requestedAmountMinor = 249_999
  expectFinancialFailure(() => assertMarketplaceProviderPayment(link(), wrongRequestedAmount))
})

test('allows only the explicit legacy session sentinel to omit request metadata', () => {
  const legacy = link()
  legacy.intent.sessionFingerprint = '0'.repeat(64)
  const verified = verification()
  delete verified.metadata.requestId
  assert.doesNotThrow(() => assertMarketplaceProviderPayment(legacy, verified))

  const current = link()
  expectFinancialFailure(() => assertMarketplaceProviderPayment(current, verified))
})
