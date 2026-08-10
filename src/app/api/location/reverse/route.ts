import { NextRequest, NextResponse } from 'next/server'
import { NIGERIAN_STATE_NAMES, type NigerianState } from '@/types'
import { getLocalGovernments } from '@/lib/nigeria-locations'

export const dynamic = 'force-dynamic'

type NominatimAddress = {
  country_code?: string
  state?: string
  state_district?: string
  county?: string
  city_district?: string
  municipality?: string
  city?: string
  town?: string
}

function normalized(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(state|local government area|lga|municipal area council)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function findState(address: NominatimAddress): NigerianState | undefined {
  const candidates = [address.state, address.state_district, address.city]
    .filter((value): value is string => Boolean(value))

  if (candidates.some((value) => /federal capital territory|\bfct\b|abuja/i.test(value))) return 'FCT'
  return NIGERIAN_STATE_NAMES.find((state) =>
    candidates.some((candidate) => normalized(candidate) === normalized(state))
  )
}

function findLga(state: NigerianState, address: NominatimAddress): string | undefined {
  const candidates = [
    address.city_district,
    address.county,
    address.municipality,
    address.state_district,
    address.city,
    address.town,
  ].filter((value): value is string => Boolean(value))
  const localGovernments = getLocalGovernments(state)

  return localGovernments.find((lga) =>
    candidates.some((candidate) => {
      const candidateName = normalized(candidate)
      const lgaName = normalized(lga)
      return candidateName === lgaName || candidateName.includes(lgaName) || lgaName.includes(candidateName)
    })
  )
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get('lat'))
  const longitude = Number(request.nextUrl.searchParams.get('lng'))

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 })
  }

  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('zoom', '10')
  url.searchParams.set('addressdetails', '1')

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Anywork365/1.0 (https://anywork365.ng)',
      },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 86_400 },
    })
    if (!response.ok) throw new Error(`Reverse geocoder returned ${response.status}`)

    const result = await response.json() as { address?: NominatimAddress }
    const address = result.address
    if (!address || address.country_code?.toLowerCase() !== 'ng') {
      return NextResponse.json({ error: 'Near-me search is currently available within Nigeria.' }, { status: 422 })
    }

    const state = findState(address)
    if (!state) {
      return NextResponse.json({ error: 'We could not match your location to a Nigerian state.' }, { status: 422 })
    }

    return NextResponse.json(
      { data: { state, lga: findLga(state, address) } },
      { headers: { 'Cache-Control': 'private, max-age=3600' } },
    )
  } catch {
    return NextResponse.json({ error: 'Location lookup is temporarily unavailable.' }, { status: 503 })
  }
}
