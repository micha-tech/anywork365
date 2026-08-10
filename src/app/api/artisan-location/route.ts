import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import { execute } from '@/lib/db'

export const runtime = 'nodejs'

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).optional(),
  locationLabel: z.string().trim().max(220).optional().default(''),
})

export async function POST(request: NextRequest) {
  const session = await getVerifiedSession()
  if (!session || session.role !== 'artisan') {
    return NextResponse.json({ error: 'Only verified artisan accounts can share a live location.' }, { status: 403 })
  }

  const parsed = locationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid location data.' }, { status: 400 })
  }

  const { latitude, longitude, accuracy, locationLabel } = parsed.data
  await execute(
    `INSERT INTO artisan_live_locations
       (uid, latitude, longitude, accuracy_meters, location_label, sharing_enabled, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, NOW())
     ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude),
       accuracy_meters = VALUES(accuracy_meters), location_label = VALUES(location_label),
       sharing_enabled = 1, updated_at = NOW()`,
    [session.id, latitude, longitude, accuracy ?? null, locationLabel],
  )

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const session = await getVerifiedSession()
  if (!session || session.role !== 'artisan') {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 403 })
  }

  await execute(
    'UPDATE artisan_live_locations SET sharing_enabled = 0, updated_at = NOW() WHERE uid = ?',
    [session.id],
  )
  return NextResponse.json({ success: true })
}
