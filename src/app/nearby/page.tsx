import Link from 'next/link'
import { NearbyArtisans } from '@/components/location/NearbyArtisans'

export const dynamic = 'force-dynamic'

export default function NearbyPage() {
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-transparent">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
        <Link href="/artisans" className="quiet-link -ml-3">← All artisans</Link>
        <div className="relative mt-5 overflow-hidden rounded-3xl bg-brand-800 p-6 text-white sm:p-9">
          <div className="absolute -right-12 -top-14 h-48 w-48 rounded-full bg-[#c9f58b]/15" />
          <h1 className="relative font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Good work can be close by</h1>
          <p className="relative mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">Choose a service and see available artisans, starting with the closest.</p>
        </div>
        <div className="mt-8 sm:mt-10">
        <NearbyArtisans />
        </div>
      </div>
    </main>
  )
}
