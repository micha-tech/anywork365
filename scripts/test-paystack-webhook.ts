import { createHmac } from 'crypto'
import { config } from 'dotenv'

config({ path: ['.env.local', '.env.production', '.env'], quiet: true })

if (!process.argv.includes('--production')) {
  throw new Error('Refusing to test the production webhook without --production')
}

const secret = process.env.PAYSTACK_SECRET_KEY
if (!secret?.startsWith('sk_live_')) {
  throw new Error('A live Paystack secret key is required')
}
const liveSecret: string = secret

process.env.FINANCIAL_WORKER_SECRET ??=
  'local-paystack-health-check-config-validation-only'

async function main() {
  const balanceResponse = await fetch('https://api.paystack.co/balance', {
    headers: { authorization: `Bearer ${liveSecret}` },
  })
  if (!balanceResponse.ok) {
    throw new Error(`Paystack rejected the live API key (${balanceResponse.status})`)
  }

  const reference = `aw365-webhook-health-${Date.now()}`
  const rawBody = JSON.stringify({
    id: reference,
    event: 'integration.test',
    data: {
      reference,
      domain: 'live',
      status: 'success',
      metadata: {
        purpose: 'signed_webhook_health_check',
        financialEffect: 'none',
      },
    },
  })
  const signature = createHmac('sha512', liveSecret).update(rawBody).digest('hex')
  const webhookResponse = await fetch('https://anywork365.ng/api/wallet/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paystack-signature': signature,
    },
    body: rawBody,
  })
  if (!webhookResponse.ok) {
    throw new Error(`Webhook receiver rejected the signed health event (${webhookResponse.status})`)
  }

  const [
    { processProviderEvents },
    { runFinancialReconciliation },
    { default: pool },
  ] = await Promise.all([
    import('../src/lib/financial/provider-events'),
    import('../src/lib/financial/reconciliation-service'),
    import('../src/lib/db'),
  ])
  try {
    const worker = await processProviderEvents(25)
    const [rows] = await pool.execute<import('mysql2/promise').RowDataPacket[]>(
      `SELECT event_type, provider_reference, signature_valid, processing_status,
              processing_attempts, last_error
       FROM provider_events
       WHERE provider_event_id = ?
       LIMIT 1`,
      [reference]
    )
    const event = rows[0]
    if (!event || event.processing_status !== 'ignored' || Number(event.signature_valid) !== 1) {
      throw new Error('Signed health event did not complete the expected ingestion path')
    }

    const reconciliation = await runFinancialReconciliation(true)
    if (reconciliation.status !== 'passed') {
      throw new Error(`Financial reconciliation found ${reconciliation.issueCount} issue(s)`)
    }

    console.log(JSON.stringify({
      status: 'passed',
      paystackLiveApi: 'authenticated',
      webhook: {
        reference,
        signatureValid: true,
        processingStatus: event.processing_status,
        financialEffect: 'none',
      },
      worker,
      reconciliation: {
        status: reconciliation.status,
        issueCount: reconciliation.issueCount,
      },
    }, null, 2))
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
