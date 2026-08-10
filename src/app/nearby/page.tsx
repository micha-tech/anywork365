import Link from 'next/link'
import { NearbyArtisans } from '@/components/location/NearbyArtisans'

export const dynamic = 'force-dynamic'

export default function NearbyPage() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-surface-base">
      <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#F0FDFA_100%)] px-4 py-7 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <Link href="/artisans" className="text-sm font-semibold text-brand-600">← All artisans</Link>
          <h1 className="mt-5 font-display text-3xl font-extrabold text-slate-950 sm:text-5xl">Artisans near you</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">Choose a service to see available artisans nearby, starting with the closest.</p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
        <NearbyArtisans />
      </div>
    </div>
  )
}
