import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { processBroadcastNotifications } from '@/lib/broadcast-notifications'
import { getFinancialConfig } from '@/lib/financial/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supplied = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const secrets = [process.env.CRON_SECRET, getFinancialConfig().FINANCIAL_WORKER_SECRET].filter((value): value is string => Boolean(value))
  const allowed = secrets.some(secret => secret.length === supplied.length && timingSafeEqual(Buffer.from(secret), Buffer.from(supplied)))
  if (!allowed) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ success: true, data: await processBroadcastNotifications(2) })
  } catch (error) {
    console.error('[BROADCAST WORKER]', error)
    return NextResponse.json({ success: false, error: 'Broadcast delivery failed' }, { status: 500 })
  }
}
