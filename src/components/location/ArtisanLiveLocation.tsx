'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  clearLocationWatch,
  getCurrentLocation,
  LocationAccessError,
  watchCurrentLocation,
  type AppPosition,
} from '@/lib/client-geolocation'

const SHARING_KEY = 'anywork365_artisan_live_location'

export function ArtisanLiveLocation() {
  const { user, loading } = useCurrentUser()
  const [sharing, setSharing] = useState(false)
  const [busy, setBusy] = useState(false)
  const watchId = useRef<string | null>(null)
  const lastSentAt = useRef(0)

  const publish = useCallback(async (position: AppPosition) => {
    if (Date.now() - lastSentAt.current < 30_000) return
    lastSentAt.current = Date.now()

    let locationLabel = ''
    try {
      const params = new URLSearchParams({
        lat: String(position.coords.latitude),
        lng: String(position.coords.longitude),
      })
      const response = await fetch(`/api/location/reverse?${params}`)
      const body = await response.json() as { data?: { state: string; lga?: string } }
      if (body.data) locationLabel = [body.data.lga, body.data.state].filter(Boolean).join(', ')
    } catch {
      // Distance search still works if the human-readable area cannot be resolved.
    }

    const response = await fetch('/api/artisan-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        locationLabel,
      }),
    })
    if (!response.ok) throw new Error('Could not update your live location.')
  }, [])

  const beginWatching = useCallback(async (requestPermission: boolean) => {
    const firstPosition = await getCurrentLocation({
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 30_000,
    }, requestPermission)
    await publish(firstPosition)
    watchId.current = await watchCurrentLocation(
      { enableHighAccuracy: true, timeout: 30_000, minimumUpdateInterval: 30_000 },
      (position, error) => {
        if (position) void publish(position).catch(() => undefined)
        if (error) console.warn('[LIVE LOCATION]', error.message)
      },
    )
    setSharing(true)
  }, [publish])

  useEffect(() => {
    if (loading || user?.role !== 'artisan' || localStorage.getItem(SHARING_KEY) !== '1') return
    void beginWatching(false).catch(() => {
      localStorage.removeItem(SHARING_KEY)
      setSharing(false)
    })
    return () => {
      if (watchId.current) void clearLocationWatch(watchId.current)
    }
  }, [beginWatching, loading, user?.role])

  if (loading || user?.role !== 'artisan') return null

  async function startSharing() {
    setBusy(true)
    try {
      await beginWatching(true)
      localStorage.setItem(SHARING_KEY, '1')
      toast.success('Clients near you can now find your profile while this app is active.')
    } catch (error) {
      toast.error(error instanceof LocationAccessError
        ? error.message
        : 'We could not start location sharing. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function stopSharing() {
    setBusy(true)
    try {
      const response = await fetch('/api/artisan-location', { method: 'DELETE' })
      if (!response.ok) throw new Error('Location sharing could not be stopped.')
      if (watchId.current) await clearLocationWatch(watchId.current)
      watchId.current = null
      localStorage.removeItem(SHARING_KEY)
      setSharing(false)
      toast.success('Live location sharing stopped.')
    } catch {
      toast.error('We could not stop location sharing. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`mb-6 overflow-hidden rounded-3xl border shadow-[0_12px_34px_rgba(15,79,74,0.06)] ${sharing ? 'border-brand-300 bg-[linear-gradient(135deg,#efffde_0%,#ffffff_70%)]' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className={`relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${sharing ? 'bg-brand-700 text-[#d8ffad]' : 'bg-slate-100 text-slate-500'}`}>
            <LocationPinIcon />
            <span className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${sharing ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-bold text-slate-900">Be visible nearby</h2>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${sharing ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {sharing ? 'On' : 'Off'}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              {sharing
                ? 'Nearby clients can now discover your profile.'
                : 'Turn this on when you are ready to take jobs around you.'}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">
              Your exact coordinates are not shown. Sharing updates while the app is open and expires after 30 minutes.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={sharing ? stopSharing : startSharing}
          aria-pressed={sharing}
          className={`min-h-11 w-full flex-shrink-0 justify-center rounded-full px-5 sm:w-auto ${sharing ? 'btn-outline border-slate-300 text-slate-700' : 'btn-primary'}`}
        >
          {busy ? 'Please wait...' : sharing ? 'Pause sharing' : 'Show me nearby'}
        </button>
      </div>
      {sharing && (
        <div className="border-t border-brand-100 bg-brand-50/70 px-4 py-2.5 text-xs font-semibold text-brand-700 sm:px-5">
          You’re showing up in nearby searches.
        </div>
      )}
    </section>
  )
}

function LocationPinIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}
