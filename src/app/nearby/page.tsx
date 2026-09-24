import Link from 'next/link'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { NearbyArtisans } from '@/components/location/NearbyArtisans'

export const dynamic = 'force-dynamic'

export default function NearbyPage() {
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-transparent">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
        <Link href="/artisans" className="quiet-link -ml-3">← All artisans</Link>
        <SectionHeader page className="mt-6" title="Good work, close by" description="Choose a service and see available artisans, starting with the closest." />
        <div className="mt-8 sm:mt-10">
        <NearbyArtisans />
        </div>
      </div>
    </main>
  )
}
