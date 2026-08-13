import Link from 'next/link'
import { NearbyArtisans } from '@/components/location/NearbyArtisans'

export const dynamic = 'force-dynamic'

export default function NearbyPage() {
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
        <Link href="/artisans" className="text-sm font-medium text-slate-500 hover:text-brand-600">← All artisans</Link>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">Artisans near you</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Choose a service to see artisans currently sharing their location, starting with the closest.</p>
        <div className="mt-8 sm:mt-10">
        <NearbyArtisans />
        </div>
      </div>
    </main>
  )
}
