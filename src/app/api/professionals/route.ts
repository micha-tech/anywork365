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

  const vendors = await cachedQuery(
    () => listVendors({ category: category || undefined, state: state || undefined, lga: lga || undefined, search: search || undefined }),
    ['professionals', category, state, lga, search],
    [CACHE_TAGS.PROFESSIONALS],
    60
  )
  const start = (page - 1) * pageSize
  const sliced = vendors.slice(start, start + pageSize)

  return NextResponse.json<ApiResponse<User[]> & { meta: { page: number; pageSize: number; total: number; hasMore: boolean } }>(
    {
      success: true,
      data: sliced,
      meta: {
        page,
        pageSize,
        total: vendors.length,
        hasMore: start + pageSize < vendors.length,
      },
    },
    { status: 200, headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } }
  )
}
