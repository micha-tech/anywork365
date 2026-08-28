'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Avatar, VerifiedBusinessBadge } from '@/components/ui'
import { BUSINESS_CATEGORY_GROUPS } from '@/types'
import { getCurrentLocation, LocationAccessError } from '@/lib/client-geolocation'
import { getInitials } from '@/lib/utils'

type NearbyArtisan = {
  id: string
  name: string
  businessName: string
  category: string
  rating: number
  reviewCount: number
  isVerified: boolean
  avatarUrl?: string
  location: string
  yearsOfExperience?: number
  distanceKm: number
  updatedAt: string
}

class NearbyRequestError extends Error {}

async function readResponse(response: Response): Promise<{ data?: NearbyArtisan[]; error?: string }> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as { data?: NearbyArtisan[]; error?: string }
  } catch {
    return {}
  }
}

function requestErrorMessage(status: number, serverMessage?: string): string {
  if (serverMessage) return serverMessage
  if (status === 429) return 'Too many nearby searches. Please wait a moment and try again.'
  if (status >= 500) return 'Nearby search is temporarily unavailable. Please try again shortly.'
  return 'We could not complete the nearby search. Please try again.'
}

export function NearbyArtisans() {
  const [category, setCategory] = useState('')
  const [artisans, setArtisans] = useState<NearbyArtisan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  async function searchNearby() {
    setLoading(true)
    setError('')
    try {
      const position = await getCurrentLocation({
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 30_000,
      })
      const params = new URLSearchParams({
        lat: String(position.coords.latitude),
        lng: String(position.coords.longitude),
        radius: '50',
      })
      if (category) params.set('category', category)

      const response = await fetch(`/api/artisans/nearby?${params}`)
      const body = await readResponse(response)
      if (!response.ok) throw new NearbyRequestError(requestErrorMessage(response.status, body.error))
      setArtisans(body.data || [])
      setHasSearched(true)
    } catch (searchError) {
      if (searchError instanceof LocationAccessError || searchError instanceof NearbyRequestError) {
        setError(searchError.message)
      } else {
        setError('We could not connect to nearby search. Check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void searchNearby() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="soft-panel p-4 sm:p-5">
        <label htmlFor="nearby-category" className="label">What kind of artisan do you need?</label>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <select id="nearby-category" value={category} onChange={(event) => setCategory(event.target.value)} className="input-field appearance-none">
            <option value="">All artisan categories</option>
            {BUSINESS_CATEGORY_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </optgroup>
            ))}
          </select>
          <button type="button" onClick={searchNearby} disabled={loading} className="btn-primary justify-center px-6">
            {loading ? 'Checking your area...' : 'Show artisans'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Shows artisans sharing a location within 50 km, ordered nearest first.</p>
      </div>

      {error && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>}

      {!loading && hasSearched && !error && (
        <div className="mt-6">
          {artisans.length ? (
            <>
              <p className="mb-4 text-sm font-medium text-slate-600">{artisans.length} artisan{artisans.length === 1 ? '' : 's'} within 50 km</p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {artisans.map((artisan) => <NearbyCard key={artisan.id} artisan={artisan} />)}
              </div>
            </>
          ) : (
            <div className="soft-panel py-12 text-center">
              <p className="font-semibold text-slate-800">No artisans near you at the moment</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NearbyCard({ artisan }: { artisan: NearbyArtisan }) {
  const displayName = artisan.businessName.trim() || artisan.name.trim()
  const ownerParts = artisan.name.trim().split(/\s+/)
  const initials = getInitials(ownerParts[0] || displayName, ownerParts.slice(1).join(' '))
  const showOwnerName = artisan.businessName.trim().toLowerCase() !== artisan.name.trim().toLowerCase()
  const reviews = Number(artisan.reviewCount || 0)
  const rating = Number(artisan.rating || 0)

  return (
    <article className="friendly-card-interactive group flex min-w-0 gap-4 p-4 sm:gap-5 sm:p-5">
      <div className="relative h-fit flex-shrink-0">
        <Avatar src={artisan.avatarUrl} initials={initials} size="xl" colorIndex={artisan.id.length} className="h-16 w-16 text-xl sm:h-[72px] sm:w-[72px]" />
        {artisan.isVerified && <VerifiedBusinessBadge label={false} size="sm" className="absolute bottom-0 right-0 border-2 border-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/artisans/${artisan.id}`} className="inline-block max-w-full">
              <h2 className="truncate font-display text-base font-bold text-slate-950 transition-colors group-hover:text-brand-600 sm:text-lg">{displayName}</h2>
            </Link>
            <p className="mt-0.5 truncate text-sm font-medium text-brand-600">{artisan.category || 'Artisan services'}</p>
          </div>
          <strong className="flex-shrink-0 rounded-full bg-[#efffde] px-2.5 py-1 text-xs text-brand-700">{artisan.distanceKm} km away</strong>
        </div>
        {showOwnerName && <p className="mt-1 truncate text-xs text-slate-500">Run by {artisan.name}</p>}
        <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600"><LocationIcon /><span className="truncate">{artisan.location}</span></p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>{reviews > 0 ? `★ ${rating.toFixed(1)} · ${reviews} review${reviews === 1 ? '' : 's'}` : 'New on Anywork365'}</span>
          {artisan.yearsOfExperience !== undefined && <span>{artisan.yearsOfExperience} year{artisan.yearsOfExperience === 1 ? '' : 's'} experience</span>}
        </div>
        <Link href={`/artisans/${artisan.id}`} className="quiet-link -ml-3 mt-2">View profile</Link>
      </div>
    </article>
  )
}

function LocationIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-brand-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9.69 18.933 10 19l.31-.067C12.83 17.72 17 13.983 17 9A7 7 0 1 0 3 9c0 4.983 4.17 8.72 6.69 9.933ZM10 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
    </svg>
  )
}
