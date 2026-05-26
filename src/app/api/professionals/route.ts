import { NextRequest, NextResponse } from 'next/server'
import { listVendors } from '@/lib/queries'
import { cachedQuery, CACHE_TAGS } from '@/lib/cache'
import type { ApiResponse, User } from '@/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || ''
  const state = searchParams.get('city') || ''
  const search = searchParams.get('search') || ''
  const limit = parseInt(searchParams.get('limit') || '0')

  const vendors = await cachedQuery(
    () => listVendors({ category: category || undefined, state: state || undefined, search: search || undefined }),
    ['professionals', category, state, search],
    [CACHE_TAGS.PROFESSIONALS],
    60
  )
  const sliced = limit > 0 ? vendors.slice(0, limit) : vendors

  return NextResponse.json<ApiResponse<User[]>>(
    { success: true, data: sliced },
    { status: 200 }
  )
}