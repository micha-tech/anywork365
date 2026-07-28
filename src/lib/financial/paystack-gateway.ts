import {
  createTransferRecipient,
  initializePayment,
  initiateRefund,
  initiateTransfer,
  resolveAccountNumber,
  verifyPayment,
  verifyTransfer,
  verifyWebhookSignature,
} from '@/lib/paystack'
import type {
  NormalizedPaymentStatus,
  NormalizedTransferStatus,
  PaymentRail,
} from './payment-rail'

function paymentStatus(value: string): NormalizedPaymentStatus {
  if (value === 'success') return 'succeeded'
  if (value === 'failed') return 'failed'
  if (value === 'abandoned') return 'cancelled'
  return 'pending'
}

function transferStatus(value: string): NormalizedTransferStatus {
  const normalized = value.toLowerCase()
  if (normalized === 'success') return 'succeeded'
  if (normalized === 'failed') return 'failed'
  if (normalized === 'reversed') return 'reversed'
  if (normalized === 'pending' || normalized === 'otp') return 'pending'
  return 'processing'
}

export class PaystackGateway implements PaymentRail {
  readonly provider = 'paystack'

  async initializePayment(input: Parameters<PaymentRail['initializePayment']>[0]) {
    const result = await initializePayment({
      email: input.email,
      amountKobo: input.amountMinor,
      reference: input.reference,
      metadata: input.metadata,
      callbackUrl: input.callbackUrl,
    })
    return {
      authorizationUrl: result.data.authorization_url,
      accessCode: result.data.access_code,
      providerReference: result.data.reference,
    }
  }

  async verifyPayment(reference: string) {
    const result = await verifyPayment(reference)
    return {
      provider: this.provider,
      reference: result.data.reference,
      providerTransactionId: String(result.data.id),
      amountMinor: result.data.amount,
      currency: result.data.currency,
      environment: result.data.domain,
      status: paymentStatus(result.data.status),
      customerEmail: result.data.customer.email,
      paymentMethod: result.data.channel || null,
      paidAt: result.data.paid_at || null,
      metadata: result.data.metadata || {},
    }
  }

  async createTransferRecipient(input: Parameters<PaymentRail['createTransferRecipient']>[0]) {
    const result = await createTransferRecipient(input)
    return { recipientCode: result.data.recipient_code }
  }

  async resolveBankAccount(input: Parameters<PaymentRail['resolveBankAccount']>[0]) {
    const result = await resolveAccountNumber(input)
    return {
      accountName: result.data.account_name,
      accountNumber: result.data.account_number,
    }
  }

  async initiateTransfer(input: Parameters<PaymentRail['initiateTransfer']>[0]) {
    const result = await initiateTransfer({
      amountKobo: input.amountMinor,
      recipientCode: input.recipientCode,
      reference: input.reference,
      reason: input.reason,
    })
    return {
      transferCode: result.data.transfer_code,
      status: transferStatus(result.data.status),
    }
  }

  async verifyTransfer(reference: string) {
    const result = await verifyTransfer(reference)
    return {
      provider: this.provider,
      reference: result.data.reference,
      transferCode: result.data.transfer_code || null,
      amountMinor: result.data.amount,
      currency: result.data.currency,
      environment: result.data.domain,
      status: transferStatus(result.data.status),
    }
  }

  async initiateRefund(input: Parameters<PaymentRail['initiateRefund']>[0]) {
    const result = await initiateRefund({
      transactionReference: input.transactionReference,
      amountKobo: input.amountMinor,
      currency: input.currency,
    })
    return {
      providerRefundReference: String(result.data.id),
      status: result.data.status,
    }
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    return verifyWebhookSignature(rawBody, signature)
  }
}

export const paymentRail: PaymentRail = new PaystackGateway()

