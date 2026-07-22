import { NextRequest, NextResponse } from 'next/server'
import { listProfessionalProfiles } from '@/lib/queries'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || undefined
  const industry = searchParams.get('industry') || undefined
  const location = searchParams.get('state') || undefined
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const pageSize = Math.min(24, Math.max(1, Number(searchParams.get('pageSize') || searchParams.get('limit') || '12')))
  const professionals = await listProfessionalProfiles({ search, industry, location })
  const start = (page - 1) * pageSize
  return NextResponse.json({
    success: true,
    data: professionals.slice(start, start + pageSize),
    meta: { page, pageSize, total: professionals.length, hasMore: start + pageSize < professionals.length },
  }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } })
}
