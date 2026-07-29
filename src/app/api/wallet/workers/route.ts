import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getFinancialConfig } from '@/lib/financial/config'
import { isMarketplaceFinanceEnabled, releaseMaturedEarnings } from '@/lib/financial/marketplace-service'
import { processFinancialOutbox } from '@/lib/financial/outbox-service'
import { processProviderEvents } from '@/lib/financial/provider-events'
import { processRequestedRefunds } from '@/lib/financial/refund-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return runWorkers(req)
}

export async function POST(req: NextRequest) {
  return runWorkers(req)
}

async function runWorkers(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!isMarketplaceFinanceEnabled()) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'Marketplace finance is disabled',
    })
  }

  const providerEvents = await processProviderEvents(25)
  const refunds = await processRequestedRefunds(10)
  const earningsReleased = await releaseMaturedEarnings(50)
  const outbox = await processFinancialOutbox(50)
  return NextResponse.json({
    success: true,
    data: { providerEvents, refunds, earningsReleased, outbox },
  })
}

function authorized(req: NextRequest): boolean {
  const supplied = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  return [process.env.CRON_SECRET, getFinancialConfig().FINANCIAL_WORKER_SECRET]
    .filter((secret): secret is string => Boolean(secret))
    .some((secret) => secureEqual(secret, supplied))
}

function secureEqual(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  )
}
