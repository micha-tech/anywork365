import { createHmac, randomUUID, timingSafeEqual } from 'crypto'

const PAYSTACK_BASE = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co'

function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY ?? ''

  if (!secret) {
    throw new Error('PAYSTACK_SECRET_KEY is not set')
  }

  return secret
}

async function paystackRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const paystackSecret = getPaystackSecret()
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const json = await res.json()

  if (!res.ok || !json.status) {
    throw new Error(json.message ?? `Paystack error: ${res.status}`)
  }

  return json
}

export async function initializePayment({
  email,
  amountKobo,
  reference,
  metadata,
  callbackUrl,
}: {
  email: string
  amountKobo: number
  reference: string
  metadata: Record<string, string>
  callbackUrl: string
}) {
  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    throw new Error('Paystack amount must be a positive integer in kobo')
  }
  return paystackRequest<{
    status: boolean
    data: { authorization_url: string; access_code: string; reference: string }
  }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: amountKobo,
      currency: 'NGN',
      reference,
      callback_url: callbackUrl,
      metadata,
      channels: ['card', 'bank', 'ussd', 'bank_transfer'],
    }),
  })
}

export async function verifyPayment(reference: string) {
  return paystackRequest<{
    status: boolean
    data: {
      id: number
      domain: 'test' | 'live'
      status: 'success' | 'failed' | 'abandoned'
      reference: string
      amount: number
      currency: string
      customer: { email: string; id: number }
      metadata: Record<string, string>
      paid_at: string
      channel: string
    }
  }>(`/transaction/verify/${encodeURIComponent(reference)}`)
}

export async function createTransferRecipient({
  accountName,
  accountNumber,
  bankCode,
}: {
  accountName: string
  accountNumber: string
  bankCode: string
}) {
  return paystackRequest<{
    status: boolean
    data: { recipient_code: string; id: number }
  }>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: 'nuban',
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
    }),
  })
}

export async function initiateTransfer({
  amountKobo,
  recipientCode,
  reference,
  reason,
}: {
  amountKobo: number
  recipientCode: string
  reference: string
  reason: string
}) {
  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    throw new Error('Paystack amount must be a positive integer in kobo')
  }
  return paystackRequest<{
    status: boolean
    data: {
      transfer_code: string
      status: string
      amount: number
    }
  }>('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount: amountKobo,
      recipient: recipientCode,
      reference,
      reason,
      currency: 'NGN',
    }),
  })
}

export async function verifyTransfer(reference: string) {
  return paystackRequest<{
    status: boolean
    data: {
      status: string
      amount: number
      currency: string
      domain: 'test' | 'live'
      reference: string
      transfer_code: string
    }
  }>(`/transfer/verify/${encodeURIComponent(reference)}`)
}

export async function initiateRefund({
  transactionReference,
  amountKobo,
  currency,
}: {
  transactionReference: string
  amountKobo: number
  currency: 'NGN'
}) {
  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    throw new Error('Paystack refund amount must be a positive integer in kobo')
  }
  return paystackRequest<{
    status: boolean
    data: { id: number; status: string; transaction: number }
  }>('/refund', {
    method: 'POST',
    body: JSON.stringify({
      transaction: transactionReference,
      amount: amountKobo,
      currency,
    }),
  })
}

export async function resolveAccountNumber({
  accountNumber,
  bankCode,
}: {
  accountNumber: string
  bankCode: string
}) {
  return paystackRequest<{
    status: boolean
    data: { account_name: string; account_number: string }
  }>(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`)
}

export async function listBanks() {
  return paystackRequest<{
    status: boolean
    data: Array<{ id: number; name: string; code: string; slug: string }>
  }>('/bank?country=nigeria&currency=NGN&perPage=100')
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hash = createHmac('sha512', getPaystackSecret())
    .update(payload)
    .digest('hex')
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(signature, 'hex'))
}

export function generateReference(prefix = 'AW365'): string {
  return `${prefix.toLowerCase().replace(/[^a-z0-9.-]/g, '-')}-${randomUUID()}`.slice(0, 50)
}
