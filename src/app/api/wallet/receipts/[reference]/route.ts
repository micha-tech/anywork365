import { NextResponse } from 'next/server'
import { getVerifiedSession } from '@/lib/auth'
import { getWalletFundingReceipt } from '@/lib/financial/wallet-funding-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }
  if (session.role !== 'client') {
    return NextResponse.json(
      { success: false, error: 'Funding receipts are available only to the paying client' },
      { status: 403 }
    )
  }

  const { reference } = await params
  const receipt = await getWalletFundingReceipt(
    decodeURIComponent(reference),
    session.id
  )
  if (!receipt) {
    return NextResponse.json(
      { success: false, error: 'Receipt not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(
    { success: true, data: receipt },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}

