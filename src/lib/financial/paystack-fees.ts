import type { MinorAmount } from './money-value'

const FIVE_THOUSAND_NAIRA = 500_000n
const TEN_THOUSAND_NAIRA = 1_000_000n
const FIFTY_THOUSAND_NAIRA = 5_000_000n

/**
 * Paystack's Nigerian bank-transfer fee bands, expressed in kobo.
 * This is an internal liquidity calculation; it must not be presented as an
 * additional charge to the artisan because the platform currently bears it.
 */
export function paystackNigeriaTransferFee(amountMinor: MinorAmount): MinorAmount {
  if (amountMinor <= 0n) return 0n
  if (amountMinor <= FIVE_THOUSAND_NAIRA) return 1_000n
  if (amountMinor <= FIFTY_THOUSAND_NAIRA) return 2_500n
  return 5_000n
}

/**
 * Nigerian electronic-transfer levy currently applied to merchant transfers
 * of NGN 10,000 and above. Registered payroll merchants can be exempted by
 * Paystack, hence the explicit option.
 */
export function paystackNigeriaTransferLevy(
  amountMinor: MinorAmount,
  options: { payrollExempt?: boolean } = {}
): MinorAmount {
  if (options.payrollExempt || amountMinor < TEN_THOUSAND_NAIRA) return 0n
  return 5_000n
}

export function paystackNigeriaProviderDebit(
  payoutMinor: MinorAmount,
  options: { payrollExempt?: boolean } = {}
): {
  payoutMinor: MinorAmount
  transferFeeMinor: MinorAmount
  transferLevyMinor: MinorAmount
  providerDebitMinor: MinorAmount
} {
  const transferFeeMinor = paystackNigeriaTransferFee(payoutMinor)
  const transferLevyMinor = paystackNigeriaTransferLevy(payoutMinor, options)
  return {
    payoutMinor,
    transferFeeMinor,
    transferLevyMinor,
    providerDebitMinor: payoutMinor + transferFeeMinor + transferLevyMinor,
  }
}
