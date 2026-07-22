import { NextRequest, NextResponse } from 'next/server'
import { listVendors } from '@/lib/queries'
import { cachedQuery, CACHE_TAGS } from '@/lib/cache'
import type { ApiResponse, User } from '@/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || ''
  const state = searchParams.get('state') || searchParams.get('city') || ''
  const lga = searchParams.get('lga') || ''
  const search = searchParams.get('search') || ''
  const limit = parseInt(searchParams.get('limit') || '0')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(24, Math.max(1, parseInt(searchParams.get('pageSize') || String(limit || 12))))
  const artisans = await cachedQuery(
    () => listVendors({ category: category || undefined, state: state || undefined, lga: lga || undefined, search: search || undefined }),
    ['artisans', category, state, lga, search],
    [CACHE_TAGS.PROFESSIONALS],
    60
  )
  const start = (page - 1) * pageSize
  return NextResponse.json<ApiResponse<User[]> & { meta: { page: number; pageSize: number; total: number; hasMore: boolean } }>({
    success: true,
    data: artisans.slice(start, start + pageSize),
    meta: { page, pageSize, total: artisans.length, hasMore: start + pageSize < artisans.length },
  }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } })
}
