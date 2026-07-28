import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getFinancialConfig } from '@/lib/financial/config'
import { isMarketplaceFinanceEnabled, releaseMaturedEarnings } from '@/lib/financial/marketplace-service'
import { processFinancialOutbox } from '@/lib/financial/outbox-service'
import { processProviderEvents } from '@/lib/financial/provider-events'
import { processRequestedRefunds } from '@/lib/financial/refund-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!isMarketplaceFinanceEnabled()) {
    return NextResponse.json({ success: false, error: 'Marketplace finance is disabled' }, { status: 503 })
  }
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
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
  const configured = Buffer.from(getFinancialConfig().FINANCIAL_WORKER_SECRET)
  const supplied = Buffer.from(
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  )
  return configured.length === supplied.length && timingSafeEqual(configured, supplied)
}
