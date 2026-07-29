import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getFinancialConfig } from '@/lib/financial/config'
import { isMarketplaceFinanceEnabled } from '@/lib/financial/marketplace-service'
import { runFinancialReconciliation } from '@/lib/financial/reconciliation-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!isMarketplaceFinanceEnabled()) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'Marketplace finance is disabled',
    })
  }

  const result = await runFinancialReconciliation(true)
  return NextResponse.json(
    { success: result.status === 'passed', data: result },
    { status: result.status === 'passed' ? 200 : 503 }
  )
}

function authorized(request: NextRequest): boolean {
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
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
