export type ProviderEnvironment = 'test' | 'live'
export type NormalizedPaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
export type NormalizedTransferStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'reversed'

export type InitializePaymentInput = {
  email: string
  amountMinor: number
  currency: 'NGN'
  reference: string
  callbackUrl: string
  metadata: Record<string, string>
}

export type PaymentVerificationResult = {
  provider: string
  reference: string
  providerTransactionId: string
  amountMinor: number
  requestedAmountMinor: number
  providerFeeMinor: number
  currency: string
  environment: ProviderEnvironment
  status: NormalizedPaymentStatus
  customerEmail: string
  paymentMethod: string | null
  gatewayResponse: string | null
  paidAt: string | null
  metadata: Record<string, string>
}

export type TransferVerificationResult = {
  provider: string
  reference: string
  transferCode: string | null
  amountMinor: number
  providerFeeMinor: number
  currency: string
  environment: ProviderEnvironment
  status: NormalizedTransferStatus
}

export interface PaymentRail {
  readonly provider: string
  initializePayment(input: InitializePaymentInput): Promise<{
    authorizationUrl: string
    accessCode: string
    providerReference: string
  }>
  verifyPayment(reference: string): Promise<PaymentVerificationResult>
  createTransferRecipient(input: {
    accountName: string
    accountNumber: string
    bankCode: string
    currency: 'NGN'
  }): Promise<{ recipientCode: string }>
  resolveBankAccount(input: {
    accountNumber: string
    bankCode: string
  }): Promise<{ accountName: string; accountNumber: string }>
  initiateTransfer(input: {
    amountMinor: number
    recipientCode: string
    reference: string
    reason: string
    currency: 'NGN'
  }): Promise<{ transferCode: string; status: NormalizedTransferStatus }>
  verifyTransfer(reference: string): Promise<TransferVerificationResult>
  initiateRefund(input: {
    transactionReference: string
    amountMinor: number
    currency: 'NGN'
  }): Promise<{ providerRefundReference: string; status: string }>
  verifyWebhook(rawBody: string, signature: string): boolean
}
