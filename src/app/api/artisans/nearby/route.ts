import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { query } from '@/lib/db'
import { getAvatarUrl } from '@/lib/avatar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface NearbyArtisanRow extends RowDataPacket {
  uid: string
  businessName: string
  fullName: string | null
  category: string
  rating: number
  reviews: number
  verified: number
  profileImage: string | null
  businessLogo: string
  locationLabel: string
  yearsOfExperience: number | null
  updatedAt: Date
  distanceKm: number
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get('lat'))
  const longitude = Number(request.nextUrl.searchParams.get('lng'))
  const category = request.nextUrl.searchParams.get('category')?.trim() || ''
  const radius = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('radius')) || 50))

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 })
  }

  const distanceSql = `(6371 * ACOS(LEAST(1, GREATEST(-1,
    COS(RADIANS(?)) * COS(RADIANS(l.latitude)) *
    COS(RADIANS(l.longitude) - RADIANS(?)) +
    SIN(RADIANS(?)) * SIN(RADIANS(l.latitude))
  ))))`
  const params: Array<string | number> = [latitude, longitude, latitude]
  let categorySql = ''
  if (category) {
    categorySql = ' AND b.category LIKE ?'
    params.push(`%${category}%`)
  }
  params.push(radius)

  try {
    const rows = await query<NearbyArtisanRow[]>(
      `SELECT b.uid, b.businessName, u.fullName, b.category, b.rating, b.reviews,
         b.verified, u.profileImage, b.businessLogo, l.location_label AS locationLabel,
         b.yearsOfExperience, l.updated_at AS updatedAt, ${distanceSql} AS distanceKm
       FROM artisan_live_locations l
       INNER JOIN businesses b ON b.uid = l.uid AND b.deleted = 0 AND b.suspended = 0
       LEFT JOIN users u ON u.uid = b.uid AND u.deleted = 0 AND u.suspended = 0
       WHERE l.sharing_enabled = 1 AND l.updated_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
         ${categorySql}
       HAVING distanceKm <= ?
       ORDER BY distanceKm ASC, b.verified DESC, b.rating DESC
       LIMIT 100`,
      params,
    )

    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.uid,
        name: row.fullName || row.businessName,
        businessName: row.businessName,
        category: row.category,
        rating: Number(row.rating),
        reviewCount: row.reviews,
        isVerified: row.verified === 1,
        avatarUrl: getAvatarUrl(row.profileImage || row.businessLogo),
        location: row.locationLabel || 'Current location shared',
        yearsOfExperience: row.yearsOfExperience ?? undefined,
        distanceKm: Math.round(Number(row.distanceKm) * 10) / 10,
        updatedAt: row.updatedAt,
      })),
    })
  } catch (error) {
    console.error('[NEARBY ARTISANS]', error)
    return NextResponse.json(
      { error: 'Nearby search is temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    )
  }
}
