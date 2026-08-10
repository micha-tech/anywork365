'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BUSINESS_CATEGORY_GROUPS } from '@/types'
import { getCurrentLocation, LocationAccessError } from '@/lib/client-geolocation'

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
          <p className="mb-4 text-sm font-medium text-slate-600">{artisans.length} artisan{artisans.length === 1 ? '' : 's'} within 50 km</p>
          {artisans.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {artisans.map((artisan) => <NearbyCard key={artisan.id} artisan={artisan} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <p className="font-semibold text-slate-800">No artisans are available nearby</p>
              <p className="mt-1 text-sm text-slate-500">Try another service or check again later.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NearbyCard({ artisan }: { artisan: NearbyArtisan }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-brand-50">
          {artisan.avatarUrl ? <img src={artisan.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-bold text-brand-600">{artisan.name.charAt(0)}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate font-bold text-slate-900">{artisan.name}</h2>
            {artisan.isVerified && <span className="text-brand-500" title="Verified">●</span>}
          </div>
          <p className="truncate text-xs text-slate-500">{artisan.category}</p>
        </div>
        <div className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-right">
          <p className="text-sm font-extrabold text-brand-700">{artisan.distanceKm} km</p>
          <p className="text-[10px] text-brand-600">away</p>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm text-slate-600"><span aria-hidden="true">⌖</span>{artisan.location}</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-slate-500">★ {artisan.rating.toFixed(1)} ({artisan.reviewCount})</p>
          <Link href={`/artisans/${artisan.id}`} className="text-sm font-bold text-brand-600">View profile →</Link>
        </div>
      </div>
    </article>
  )
}
