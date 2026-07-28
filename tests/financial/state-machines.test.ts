import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertTransition,
  jobFundsTransitions,
  paymentIntentTransitions,
  withdrawalTransitions,
} from '../../src/lib/financial/state-machines'

test('allows intended terminal financial transitions', () => {
  assert.doesNotThrow(() =>
    assertTransition(paymentIntentTransitions, 'initialized', 'succeeded', 'Payment')
  )
  assert.doesNotThrow(() =>
    assertTransition(jobFundsTransitions, 'locked', 'released', 'Job funds')
  )
  assert.doesNotThrow(() =>
    assertTransition(withdrawalTransitions, 'processing', 'success', 'Withdrawal')
  )
})

test('rejects skips and terminal-state mutation', () => {
  assert.throws(() =>
    assertTransition(jobFundsTransitions, 'awaiting_funding', 'released', 'Job funds')
  )
  assert.throws(() =>
    assertTransition(paymentIntentTransitions, 'refunded', 'succeeded', 'Payment')
  )
  assert.throws(() =>
    assertTransition(withdrawalTransitions, 'success', 'processing', 'Withdrawal')
  )
})
