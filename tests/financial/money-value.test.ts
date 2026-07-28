import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateBasisPoints,
  majorToMinor,
  minorToMajorString,
} from '../../src/lib/financial/money-value'

test('majorToMinor parses NGN without floating point arithmetic', () => {
  assert.equal(majorToMinor('1,234.56'), BigInt(123456))
  assert.equal(minorToMajorString(BigInt(123456)), '1234.56')
})

test('money parser rejects excess precision, signs and zero', () => {
  for (const invalid of ['10.001', '-1.00', '0', 'abc', '']) {
    assert.throws(() => majorToMinor(invalid))
  }
})

test('basis point fee rounds half-up and applies caps', () => {
  assert.equal(calculateBasisPoints(BigInt(101), 500), BigInt(5))
  assert.equal(
    calculateBasisPoints(BigInt(10_000), 500, { minimum: BigInt(600) }),
    BigInt(600)
  )
  assert.equal(
    calculateBasisPoints(BigInt(100_000), 500, { maximum: BigInt(2_000) }),
    BigInt(2_000)
  )
})

test('basis point property: fee remains between zero and amount', () => {
  let seed = 0x3652026
  for (let index = 0; index < 2_000; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const amount = BigInt((seed % 10_000_000) + 1)
    const bps = seed % 10_001
    const fee = calculateBasisPoints(amount, bps)
    assert.ok(fee >= BigInt(0))
    assert.ok(fee <= amount)
  }
})
