'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import mapboxgl, { type GeoJSONSource, type MapMouseEvent } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export type MapArtisan = {
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
  approximateLatitude: number
  approximateLongitude: number
}

type NearbyArtisanMapProps = {
  artisans: MapArtisan[]
  center: { latitude: number; longitude: number }
}

const MAP_SOURCE = 'nearby-artisans'
const CATEGORY_MARKERS = [
  ['plumbing', '/images/categories/plumbing.webp'],
  ['electrical', '/images/categories/electrical.webp'],
  ['carpentry', '/images/categories/carpentry.webp'],
  ['painting', '/images/categories/painting.webp'],
  ['hvac', '/images/categories/hvac.webp'],
  ['welding', '/images/categories/welding.webp'],
] as const

function markerFor(category: string) {
  const normalized = category.toLowerCase()
  if (normalized.includes('plumb')) return 'plumbing'
  if (normalized.includes('electric')) return 'electrical'
  if (normalized.includes('carpent') || normalized.includes('furniture')) return 'carpentry'
  if (normalized.includes('paint')) return 'painting'
  if (normalized.includes('hvac') || normalized.includes('ac ')) return 'hvac'
  if (normalized.includes('weld') || normalized.includes('metal')) return 'welding'
  return 'carpentry'
}

export function NearbyArtisanMap({ artisans, center }: NearbyArtisanMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const [ready, setReady] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => artisans.find(artisan => artisan.id === selectedId) ?? null, [artisans, selectedId])

  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: artisans
      .filter(artisan => Number.isFinite(artisan.approximateLatitude) && Number.isFinite(artisan.approximateLongitude))
      .map(artisan => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [artisan.approximateLongitude, artisan.approximateLatitude],
        },
        properties: {
          id: artisan.id,
          name: artisan.businessName || artisan.name,
          marker: markerFor(artisan.category),
        },
      })),
  }), [artisans])
  const initialCenterRef = useRef(center)
  const initialGeojsonRef = useRef(geojson)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if (!token) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [initialCenterRef.current.longitude, initialCenterRef.current.latitude],
      zoom: 11.5,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('load', async () => {
      await Promise.all(CATEGORY_MARKERS.map(([name, path]) => new Promise<void>((resolve, reject) => {
        map.loadImage(path, (error, image) => {
          if (error) {
            reject(error)
            return
          }
          if (image && !map.hasImage(`artisan-${name}`)) map.addImage(`artisan-${name}`, image)
          resolve()
        })
      })))

      map.addSource(MAP_SOURCE, {
        type: 'geojson',
        data: initialGeojsonRef.current,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 54,
      })

      map.addLayer({
        id: 'artisan-clusters-shadow',
        type: 'circle',
        source: MAP_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#073b38',
          'circle-radius': ['step', ['get', 'point_count'], 23, 10, 28, 30, 34],
          'circle-translate': [0, 4],
          'circle-opacity': 0.28,
        },
      })
      map.addLayer({
        id: 'artisan-clusters',
        type: 'circle',
        source: MAP_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#0f4f4a',
          'circle-stroke-color': '#d8ffad',
          'circle-stroke-width': 4,
          'circle-radius': ['step', ['get', 'point_count'], 22, 10, 27, 30, 33],
        },
      })
      map.addLayer({
        id: 'artisan-cluster-count',
        type: 'symbol',
        source: MAP_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 13,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': '#ffffff' },
      })
      map.addLayer({
        id: 'artisan-pins-halo',
        type: 'circle',
        source: MAP_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 27,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#d8ffad',
          'circle-stroke-width': 3,
          'circle-translate': [0, 3],
        },
      })
      map.addLayer({
        id: 'artisan-pins',
        type: 'symbol',
        source: MAP_SOURCE,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['concat', 'artisan-', ['get', 'marker']],
          'icon-size': 0.2,
          'icon-allow-overlap': true,
          'icon-anchor': 'center',
        },
      })

      type RenderedPoint = { geometry: { type: string; coordinates: [number, number] }; properties?: Record<string, unknown> }
      const clusterClick = (event: MapMouseEvent) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ['artisan-clusters'] })[0] as unknown as RenderedPoint | undefined
        if (!feature || feature.geometry.type !== 'Point') return
        const clusterId = Number(feature.properties?.cluster_id)
        const source = map.getSource(MAP_SOURCE) as GeoJSONSource
        source.getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (!error && typeof zoom === 'number') map.easeTo({ center: feature.geometry.coordinates, zoom })
        })
      }
      const pinClick = (event: MapMouseEvent) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ['artisan-pins'] })[0] as unknown as RenderedPoint | undefined
        const id = feature?.properties?.id
        if (typeof id === 'string') setSelectedId(id)
      }
      map.on('click', 'artisan-clusters', clusterClick)
      map.on('click', 'artisan-pins', pinClick)
      for (const layer of ['artisan-clusters', 'artisan-pins']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }
      setReady(true)
    })

    return () => {
      userMarkerRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const source = map.getSource(MAP_SOURCE) as GeoJSONSource | undefined
    source?.setData(geojson)

    userMarkerRef.current?.remove()
    const locationDot = document.createElement('div')
    locationDot.className = 'anywork-map-user-marker'
    locationDot.setAttribute('aria-label', 'Your approximate location')
    userMarkerRef.current = new mapboxgl.Marker({ element: locationDot })
      .setLngLat([center.longitude, center.latitude])
      .addTo(map)

    const bounds = new mapboxgl.LngLatBounds([center.longitude, center.latitude], [center.longitude, center.latitude])
    geojson.features.forEach(feature => bounds.extend(feature.geometry.coordinates as [number, number]))
    if (geojson.features.length > 0) map.fitBounds(bounds, { padding: { top: 70, right: 60, bottom: 120, left: 60 }, maxZoom: 13, duration: 700 })
    else map.easeTo({ center: [center.longitude, center.latitude], zoom: 12 })
  }, [center.latitude, center.longitude, geojson, ready])

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-brand-100 bg-[#e8f1ea] shadow-[0_8px_0_#c8d9cf,0_24px_50px_rgba(15,79,74,0.14)]">
      <div ref={containerRef} className="h-[62dvh] min-h-[430px] max-h-[650px] w-full sm:h-[560px]" aria-label="Map of nearby artisans" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#edf5ef]">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
            <p className="mt-3 text-sm font-bold text-brand-800">Preparing your nearby map…</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-4.5rem)] items-center gap-3 rounded-2xl border border-white/70 bg-white/90 p-2.5 pr-4 shadow-lg backdrop-blur sm:left-4 sm:top-4">
        <Image src="/images/story/people.webp" alt="" width={68} height={52} className="h-11 w-14 flex-none object-contain" />
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-slate-900 sm:text-sm">Good work, close by</p>
          <p className="truncate text-[10px] text-slate-500 sm:text-xs">Pins show approximate areas</p>
        </div>
      </div>

      {selected && (
        <article className="absolute inset-x-3 bottom-3 rounded-3xl border border-white/80 bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.22)] backdrop-blur sm:left-4 sm:right-auto sm:w-[390px]">
          <button type="button" onClick={() => setSelectedId(null)} aria-label="Close artisan preview" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">×</button>
          <div className="flex items-start gap-3 pr-8">
            <div className="solid-3d-icon h-14 w-14 flex-none bg-brand-50 p-1">
              <Image src={CATEGORY_MARKERS.find(([name]) => name === markerFor(selected.category))?.[1] ?? '/images/categories/carpentry.webp'} alt="" width={56} height={56} className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-black text-slate-950">{selected.businessName || selected.name}</h3>
              <p className="mt-0.5 truncate text-xs font-bold text-brand-600">{selected.category || 'Artisan services'}</p>
              <p className="mt-1 text-xs text-slate-500">{selected.distanceKm} km away · {selected.reviewCount > 0 ? `★ ${selected.rating.toFixed(1)}` : 'New on Anywork365'}</p>
            </div>
          </div>
          <Link href={`/artisans/${selected.id}`} className="btn-primary mt-3 w-full justify-center">View profile</Link>
        </article>
      )}
    </div>
  )
}
