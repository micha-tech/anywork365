import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertBalancedJournal,
  consolidateJournal,
} from '../../src/lib/financial/ledger-invariants'

test('accepts a balanced two-sided NGN journal', () => {
  assert.doesNotThrow(() =>
    assertBalancedJournal([
      { accountKey: 'external', currency: 'NGN', deltaMinor: BigInt(-10_000) },
      { accountKey: 'locked', currency: 'NGN', deltaMinor: BigInt(10_000) },
    ])
  )
})

test('rejects unbalanced, zero, one-account and mixed-currency journals', () => {
  assert.throws(() =>
    assertBalancedJournal([
      { accountKey: 'a', currency: 'NGN', deltaMinor: BigInt(-100) },
      { accountKey: 'b', currency: 'NGN', deltaMinor: BigInt(99) },
    ])
  )
  assert.throws(() =>
    assertBalancedJournal([
      { accountKey: 'a', currency: 'NGN', deltaMinor: BigInt(0) },
      { accountKey: 'b', currency: 'NGN', deltaMinor: BigInt(0) },
    ])
  )
  assert.throws(() =>
    assertBalancedJournal([
      { accountKey: 'same', currency: 'NGN', deltaMinor: BigInt(-100) },
      { accountKey: 'same', currency: 'NGN', deltaMinor: BigInt(100) },
    ])
  )
  assert.throws(() =>
    assertBalancedJournal([
      { accountKey: 'a', currency: 'NGN', deltaMinor: BigInt(-100) },
      { accountKey: 'b', currency: 'USD', deltaMinor: BigInt(100) },
    ])
  )
})

test('consolidation preserves a zero-sum property for generated journals', () => {
  for (let amount = 1; amount <= 1_000; amount += 1) {
    const lines = consolidateJournal([
      { accountKey: 'source', currency: 'NGN', deltaMinor: BigInt(-amount) },
      { accountKey: 'destination', currency: 'NGN', deltaMinor: BigInt(amount - 1) },
      { accountKey: 'fee', currency: 'NGN', deltaMinor: BigInt(1) },
    ])
    assert.equal(lines.reduce((sum, line) => sum + line.deltaMinor, BigInt(0)), BigInt(0))
    assert.doesNotThrow(() => assertBalancedJournal(lines))
  }
})
