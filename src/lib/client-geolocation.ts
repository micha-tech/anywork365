import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

export type AppPosition = {
  coords: {
    latitude: number
    longitude: number
    accuracy: number
  }
  timestamp: number
}

type PositionOptions = {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  minimumUpdateInterval?: number
}

function browserPosition(options: PositionOptions): Promise<AppPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Location is not supported by this browser.'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(new Error(browserLocationError(error))),
      options,
    )
  })
}

function browserLocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return 'Allow location access in your browser and try again.'
  if (error.code === error.POSITION_UNAVAILABLE) return 'Your location is currently unavailable.'
  if (error.code === error.TIMEOUT) return 'Location lookup timed out. Check that location services are enabled.'
  return 'Could not get your current location.'
}

async function ensureNativePermission(requestPermission: boolean): Promise<void> {
  let permission = await Geolocation.checkPermissions()
  if (requestPermission && permission.location === 'prompt') {
    permission = await Geolocation.requestPermissions()
  }
  if (permission.location !== 'granted') {
    throw new Error('Allow location access in your device settings and try again.')
  }
}

export async function getCurrentLocation(
  options: PositionOptions,
  requestPermission = true,
): Promise<AppPosition> {
  if (!Capacitor.isNativePlatform()) return browserPosition(options)

  await ensureNativePermission(requestPermission)
  return Geolocation.getCurrentPosition(options)
}

export async function watchCurrentLocation(
  options: PositionOptions,
  callback: (position: AppPosition | null, error?: Error) => void,
): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      throw new Error('Location is not supported by this browser.')
    }
    const id = navigator.geolocation.watchPosition(
      (position) => callback(position),
      (error) => callback(null, new Error(browserLocationError(error))),
      options,
    )
    return `web:${id}`
  }

  const id = await Geolocation.watchPosition(options, (position, error) => {
    callback(position, error ? new Error(error.message) : undefined)
  })
  return `native:${id}`
}

export async function clearLocationWatch(id: string): Promise<void> {
  const [platform, watchId] = id.split(':', 2)
  if (platform === 'web') {
    navigator.geolocation.clearWatch(Number(watchId))
    return
  }
  await Geolocation.clearWatch({ id: watchId })
}
