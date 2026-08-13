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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {artisans.map((artisan) => <NearbyCard key={artisan.id} artisan={artisan} />)}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
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
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-lg">
      <div className="relative h-20 bg-[linear-gradient(120deg,#0F4F4A_0%,#1F6F68_72%,#D8A928_180%)] sm:h-24">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_80%_10%,white_0,transparent_36%)]" />
        <span className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
          {artisan.distanceKm} km away
        </span>
      </div>

      <div className="relative flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="-mt-9 mb-3 flex items-end justify-between gap-3 sm:-mt-10">
          <div className="relative rounded-full bg-white p-1 shadow-sm">
            <Avatar
              src={artisan.avatarUrl}
              initials={initials}
              size="xl"
              colorIndex={artisan.id.length}
              className="h-16 w-16 border border-slate-100 text-xl sm:h-[72px] sm:w-[72px]"
            />
            {artisan.isVerified && (
              <VerifiedBusinessBadge label={false} className="absolute bottom-1 right-0 border-2 border-white shadow-sm" />
            )}
          </div>
          <span className="mb-1 max-w-[58%] truncate rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
            {artisan.category || 'Artisan services'}
          </span>
        </div>

        <Link href={`/artisans/${artisan.id}`} className="inline-block max-w-full">
          <h2 className="truncate font-display text-lg font-bold text-slate-950 transition-colors group-hover:text-brand-500 sm:text-xl">
            {displayName}
          </h2>
        </Link>
        {showOwnerName && <p className="mt-0.5 truncate text-xs text-slate-500">Run by {artisan.name}</p>}

        <p className="mt-3 flex min-w-0 items-center gap-1.5 text-sm text-slate-600">
          <LocationIcon />
          <span className="truncate">{artisan.location}</span>
        </p>

        <div className="my-4 grid grid-cols-2 divide-x divide-slate-200 rounded-xl border border-slate-100 bg-slate-50/80 py-2.5">
          <div className="flex min-w-0 items-center justify-center gap-1.5 px-2 text-sm">
            <StarIcon />
            {reviews > 0 ? (
              <>
                <span className="font-bold text-slate-900">{rating.toFixed(1)}</span>
                <span className="truncate text-xs text-slate-500">({reviews})</span>
              </>
            ) : (
              <span className="font-semibold text-slate-600">New</span>
            )}
          </div>
          <div className="flex min-w-0 items-center justify-center px-2 text-sm">
            <span className="truncate font-bold text-slate-900">
              {artisan.yearsOfExperience !== undefined
                ? `${artisan.yearsOfExperience} yr${artisan.yearsOfExperience === 1 ? '' : 's'} experience`
                : 'Experience not listed'}
            </span>
          </div>
        </div>

        <div className="mt-auto border-t border-slate-100 pt-4">
          <Link href={`/artisans/${artisan.id}`} className="btn-primary w-full justify-between px-4 py-2.5 text-sm">
            <span>View profile</span>
            <ArrowIcon />
          </Link>
        </div>
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

function StarIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 0 0 .95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 0 0-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 0 0-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 0 0-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 0 0 .95-.69l1.07-3.29Z" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
    </svg>
  )
}
