export const NGN = 'NGN' as const
export type SupportedCurrency = typeof NGN
export type MinorAmount = bigint

const CURRENCY_SCALE: Record<SupportedCurrency, bigint> = { NGN: 100n }

export function assertCurrency(value: string): SupportedCurrency {
  if (value !== NGN) throw new Error(`Unsupported currency: ${value}`)
  return value
}

export function assertMinorAmount(value: bigint, options?: { allowZero?: boolean }): MinorAmount {
  if (options?.allowZero ? value < 0n : value <= 0n) {
    throw new Error(options?.allowZero ? 'Amount cannot be negative' : 'Amount must be positive')
  }
  return value
}

export function minorFromDatabase(value: string | number | bigint): MinorAmount {
  const parsed = typeof value === 'bigint' ? value : BigInt(String(value))
  if (parsed < 0n) throw new Error('Database amount cannot be negative')
  return parsed
}

export function majorToMinor(
  value: string,
  currency: SupportedCurrency = NGN
): MinorAmount {
  const normalized = value.trim().replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Money must have at most two decimal places')
  }
  const [whole, fraction = ''] = normalized.split('.')
  const scale = CURRENCY_SCALE[currency]
  const minor = BigInt(whole) * scale + BigInt(fraction.padEnd(2, '0'))
  return assertMinorAmount(minor)
}

export function minorToMajorString(
  value: MinorAmount,
  currency: SupportedCurrency = NGN
): string {
  const scale = CURRENCY_SCALE[currency]
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  const whole = absolute / scale
  const fraction = (absolute % scale).toString().padStart(2, '0')
  return `${sign}${whole}.${fraction}`
}

export function addMinor(...values: MinorAmount[]): MinorAmount {
  return values.reduce((total, value) => total + value, 0n)
}

export function subtractMinor(left: MinorAmount, right: MinorAmount): MinorAmount {
  return left - right
}

export function compareMinor(left: MinorAmount, right: MinorAmount): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0
}

export function calculateBasisPoints(
  amount: MinorAmount,
  basisPoints: number,
  options?: { minimum?: MinorAmount; maximum?: MinorAmount | null }
): MinorAmount {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new Error('Basis points must be an integer between 0 and 10000')
  }
  // Round half-up using integers only.
  let fee = (amount * BigInt(basisPoints) + 5_000n) / 10_000n
  if (options?.minimum !== undefined && fee < options.minimum) fee = options.minimum
  if (options?.maximum !== undefined && options.maximum !== null && fee > options.maximum) {
    fee = options.maximum
  }
  if (fee > amount) throw new Error('Calculated fee exceeds the source amount')
  return fee
}

export function toSafeDatabaseInteger(value: MinorAmount): number {
  const asNumber = Number(value)
  if (!Number.isSafeInteger(asNumber)) throw new Error('Amount exceeds JavaScript safe integer range')
  return asNumber
}

