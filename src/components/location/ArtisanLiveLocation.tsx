'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Geolocation, type Position } from '@capacitor/geolocation'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const SHARING_KEY = 'anywork365_artisan_live_location'

export function ArtisanLiveLocation() {
  const { user, loading } = useCurrentUser()
  const [sharing, setSharing] = useState(false)
  const [busy, setBusy] = useState(false)
  const watchId = useRef<string | null>(null)
  const lastSentAt = useRef(0)

  const publish = useCallback(async (position: Position) => {
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
    let permission = await Geolocation.checkPermissions()
    if (requestPermission && permission.location === 'prompt') {
      permission = await Geolocation.requestPermissions()
    }
    if (permission.location !== 'granted') throw new Error('Location permission was not granted.')

    const firstPosition = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 30_000,
    })
    await publish(firstPosition)
    watchId.current = await Geolocation.watchPosition(
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
      if (watchId.current) void Geolocation.clearWatch({ id: watchId.current })
    }
  }, [beginWatching, loading, user?.role])

  if (loading || user?.role !== 'artisan') return null

  async function startSharing() {
    setBusy(true)
    try {
      await beginWatching(true)
      localStorage.setItem(SHARING_KEY, '1')
      toast.success('Your live location is now visible in Nearby while this app is active.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start location sharing.')
    } finally {
      setBusy(false)
    }
  }

  async function stopSharing() {
    setBusy(true)
    try {
      if (watchId.current) await Geolocation.clearWatch({ id: watchId.current })
      watchId.current = null
      await fetch('/api/artisan-location', { method: 'DELETE' })
      localStorage.removeItem(SHARING_KEY)
      setSharing(false)
      toast.success('Live location sharing stopped.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div>
        <p className="text-sm font-bold text-brand-800">Live location</p>
        <p className="mt-0.5 text-xs text-brand-700">
          {sharing ? 'Visible in Nearby while the app is active. It expires after 30 minutes.' : 'Share your current position so nearby clients can find you.'}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={sharing ? stopSharing : startSharing}
        className={`mt-3 w-full justify-center sm:mt-0 sm:w-auto ${sharing ? 'btn-outline' : 'btn-primary'}`}
      >
        {busy ? 'Please wait...' : sharing ? 'Stop sharing' : 'Share live location'}
      </button>
    </div>
  )
}
