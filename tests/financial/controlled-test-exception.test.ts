import assert from 'node:assert/strict'
import test from 'node:test'
import { getControlledWithdrawalTestException } from '../../src/lib/financial/controlled-test-exception'

test('controlled withdrawal exception is exact-user and time bounded', () => {
  const previousUid = process.env.CONTROLLED_WITHDRAWAL_TEST_ARTISAN_UID
  const previousExpiry = process.env.CONTROLLED_WITHDRAWAL_TEST_EXPIRES_AT

  try {
    process.env.CONTROLLED_WITHDRAWAL_TEST_ARTISAN_UID = 'artisan-under-test'
    process.env.CONTROLLED_WITHDRAWAL_TEST_EXPIRES_AT = new Date(
      Date.now() + 60_000
    ).toISOString()

    assert.equal(getControlledWithdrawalTestException('artisan-under-test').active, true)
    assert.equal(getControlledWithdrawalTestException('different-artisan').active, false)

    process.env.CONTROLLED_WITHDRAWAL_TEST_EXPIRES_AT = new Date(
      Date.now() - 60_000
    ).toISOString()
    assert.equal(getControlledWithdrawalTestException('artisan-under-test').active, false)
  } finally {
    if (previousUid === undefined) {
      delete process.env.CONTROLLED_WITHDRAWAL_TEST_ARTISAN_UID
    } else {
      process.env.CONTROLLED_WITHDRAWAL_TEST_ARTISAN_UID = previousUid
    }
    if (previousExpiry === undefined) {
      delete process.env.CONTROLLED_WITHDRAWAL_TEST_EXPIRES_AT
    } else {
      process.env.CONTROLLED_WITHDRAWAL_TEST_EXPIRES_AT = previousExpiry
    }
  }
})
