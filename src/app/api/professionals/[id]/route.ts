import { NextRequest, NextResponse } from 'next/server'
import { getVendorByUid, getReviewsByBusiness, getBusinessByUid } from '@/lib/queries'
import { cachedQuery, CACHE_TAGS } from '@/lib/cache'
import type { ApiResponse } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const vendor = await cachedQuery(
    () => getVendorByUid(id),
    ['vendor', id],
    [CACHE_TAGS.PROFESSIONAL(id), CACHE_TAGS.PROFESSIONALS],
    120
  )
  if (!vendor) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Vendor not found' },
      { status: 404 }
    )
  }

  const business = await cachedQuery(
    () => getBusinessByUid(id),
    ['business', id],
    [CACHE_TAGS.PROFESSIONAL(id), CACHE_TAGS.PROFESSIONALS],
    120
  )
  const reviews = business
    ? await cachedQuery(
        () => getReviewsByBusiness(business.businessId),
        ['reviews', String(business.businessId)],
        [CACHE_TAGS.PROFESSIONAL(id), CACHE_TAGS.PROFESSIONALS],
        120
      )
    : []

  return NextResponse.json(
    { success: true, data: { vendor, reviews } },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } }
  )
}