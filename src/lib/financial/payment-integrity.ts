import { FinancialError } from './errors'
import type { PaymentVerificationResult } from './payment-rail'

const LEGACY_SESSION_FINGERPRINT = '0'.repeat(64)

export type MarketplacePaymentLink = {
  intent: {
    id: number
    internalReference: string
    bookingId: number
    jobFundId: number
    quoteId: number
    clientUid: string
    customerEmail: string
    amountMinor: bigint
    currency: string
    provider: string
    providerReference: string | null
    requestId: string
    sessionFingerprint: string
  }
  jobFund: {
    id: number
    bookingId: number
    quoteId: number
    clientUid: string
    artisanUid: string
    amountMinor: bigint
    currency: string
  }
  quote: {
    id: number
    bookingId: number
    artisanUid: string
    amountMinor: bigint
    status: string
  }
  booking: {
    id: number
    clientUid: string
    artisanUid: string
    amountMinor: bigint
    status: string
  }
  account?: {
    paymentIntentId: number
    bookingId: number
    quoteId: number
    clientUid: string
    amountMinor: bigint
    currency: string
    provider: string
    providerReference: string
    status: string
  }
}

export function assertMarketplacePaymentLink(
  link: MarketplacePaymentLink,
  options: { requirePaymentAccount: boolean }
): void {
  const { intent, jobFund, quote, booking, account } = link
  const sameIdentity =
    intent.bookingId === booking.id &&
    intent.bookingId === jobFund.bookingId &&
    intent.bookingId === quote.bookingId &&
    intent.jobFundId === jobFund.id &&
    intent.quoteId === quote.id &&
    jobFund.quoteId === quote.id &&
    intent.clientUid === booking.clientUid &&
    intent.clientUid === jobFund.clientUid &&
    jobFund.artisanUid === booking.artisanUid &&
    jobFund.artisanUid === quote.artisanUid
  const sameValue =
    intent.amountMinor === jobFund.amountMinor &&
    intent.amountMinor === quote.amountMinor &&
    intent.amountMinor === booking.amountMinor &&
    intent.currency === jobFund.currency

  if (!sameIdentity || !sameValue || quote.status !== 'accepted') {
    throw new FinancialError(
      'INVALID_STATE',
      'Payment records do not match the accepted quote and booking.',
      409
    )
  }

  if (options.requirePaymentAccount && !account) {
    throw new FinancialError('INVALID_STATE', 'The payment account link is missing.', 409)
  }
  if (!account) return

  if (
    account.paymentIntentId !== intent.id ||
    account.bookingId !== intent.bookingId ||
    account.quoteId !== intent.quoteId ||
    account.clientUid !== intent.clientUid ||
    account.amountMinor !== intent.amountMinor ||
    account.currency !== intent.currency ||
    account.provider !== intent.provider ||
    (intent.providerReference !== null &&
      account.providerReference !== intent.providerReference)
  ) {
    throw new FinancialError(
      'INVALID_STATE',
      'Payment account records do not match this transaction.',
      409
    )
  }
}

export function assertMarketplaceProviderPayment(
  link: MarketplacePaymentLink,
  verified: PaymentVerificationResult
): void {
  assertMarketplacePaymentLink(link, { requirePaymentAccount: true })
  const { intent, account } = link
  if (!account) {
    throw new FinancialError('INVALID_STATE', 'The payment account link is missing.', 409)
  }

  if (
    !intent.providerReference ||
    verified.provider !== intent.provider ||
    verified.reference !== intent.providerReference ||
    verified.reference !== account.providerReference ||
    !verified.providerTransactionId
  ) {
    throw new FinancialError(
      'NOT_AUTHORIZED',
      'Provider reference does not match this payment intent.',
      403
    )
  }

  if (
    BigInt(verified.amountMinor) !== intent.amountMinor ||
    BigInt(verified.requestedAmountMinor) !== intent.amountMinor ||
    verified.currency !== intent.currency ||
    verified.customerEmail.toLowerCase() !== intent.customerEmail.toLowerCase()
  ) {
    throw new FinancialError(
      'NOT_AUTHORIZED',
      'Provider payment details do not match this payment intent.',
      403
    )
  }

  const requestIdMatches =
    verified.metadata.requestId === intent.requestId ||
    (intent.sessionFingerprint === LEGACY_SESSION_FINGERPRINT &&
      verified.metadata.requestId === undefined)
  if (
    verified.metadata.type !== 'booking_funding' ||
    verified.metadata.bookingId !== String(intent.bookingId) ||
    verified.metadata.quoteId !== String(intent.quoteId) ||
    verified.metadata.clientUid !== intent.clientUid ||
    verified.metadata.paymentIntentId !== String(intent.id) ||
    !requestIdMatches
  ) {
    throw new FinancialError(
      'NOT_AUTHORIZED',
      'Provider metadata does not match this payment intent.',
      403
    )
  }
}
