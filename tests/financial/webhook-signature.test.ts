import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { verifyWebhookSignature } from '../../src/lib/paystack'

test('accepts only the exact raw body signed with the Paystack secret', () => {
  const previous = process.env.PAYSTACK_SECRET_KEY
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_security_test_secret'
  try {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } })
    const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(body)
      .digest('hex')
    assert.equal(verifyWebhookSignature(body, signature), true)
    assert.equal(verifyWebhookSignature(`${body} `, signature), false)
    assert.equal(verifyWebhookSignature(body, 'not-a-signature'), false)
  } finally {
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY
    else process.env.PAYSTACK_SECRET_KEY = previous
  }
})
