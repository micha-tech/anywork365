import assert from 'node:assert/strict'
import test from 'node:test'
import {
  paystackNigeriaProviderDebit,
  paystackNigeriaTransferFee,
  paystackNigeriaTransferLevy,
} from '../../src/lib/financial/paystack-fees'

test('uses the current Nigerian transfer fee bands', () => {
  assert.equal(paystackNigeriaTransferFee(500_000n), 1_000n)
  assert.equal(paystackNigeriaTransferFee(500_001n), 2_500n)
  assert.equal(paystackNigeriaTransferFee(5_000_000n), 2_500n)
  assert.equal(paystackNigeriaTransferFee(5_000_001n), 5_000n)
})

test('adds the transfer levy from NGN 10,000 unless payroll exempt', () => {
  assert.equal(paystackNigeriaTransferLevy(999_999n), 0n)
  assert.equal(paystackNigeriaTransferLevy(1_000_000n), 5_000n)
  assert.equal(paystackNigeriaTransferLevy(1_000_000n, { payrollExempt: true }), 0n)
})

test('requires Paystack liquidity for payout, fee and levy without reducing payout', () => {
  assert.deepEqual(paystackNigeriaProviderDebit(2_000_000n), {
    payoutMinor: 2_000_000n,
    transferFeeMinor: 2_500n,
    transferLevyMinor: 5_000n,
    providerDebitMinor: 2_007_500n,
  })
})
