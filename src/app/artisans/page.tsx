import { listVendors } from '@/lib/queries'
import { ProCard } from '@/components/forms/ProCard'
import { ProfessionalFilters } from '@/components/forms/ProfessionalFilters'
import { EmptyState } from '@/components/ui'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  'All',
  'Carpentry & Furniture',
  'Painting & Wall Finishing',
  'Auto Mechanics',
  'Plumbing Services',
  'Tailoring & Fashion Design',
]

const PAGE_SIZE = 12

export default async function ArtisansPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string; state?: string; lga?: string; search?: string; page?: string }>
}) {
  const { category, state, lga, search, page } = (await searchParams) ?? {}
  const currentPage = Math.max(1, parseInt(page || '1'))
  const allVendors = await listVendors({ category, state, lga, search })
  const vendors = allVendors.slice(0, currentPage * PAGE_SIZE)
  const totalCount = allVendors.length
  const hasMore = totalCount > currentPage * PAGE_SIZE

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">Artisans</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Find skilled artisans and service providers for the work you need.</p>
          </div>
          <Link href="/nearby" className="btn-outline w-fit px-4 py-2 text-sm">Near me</Link>
        </header>

        <div className="mt-8 sm:mt-10">
        <ProfessionalFilters category={category} state={state} lga={lga} search={search} />
        </div>

        <nav aria-label="Quick artisan categories" className="-mx-4 flex gap-6 overflow-x-auto border-b border-slate-200 px-4 pb-3 sm:mx-0 sm:px-0">
          {CATEGORIES.map((item) => (
            <a
              key={item}
              href={`/artisans?${new URLSearchParams({
                ...(item !== 'All' ? { category: item } : {}),
                ...(state ? { state } : {}),
                ...(lga ? { lga } : {}),
                ...(search ? { search } : {}),
              }).toString()}`}
              className={`relative flex min-h-10 flex-shrink-0 items-center text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-3 after:h-0.5 ${
                category === item || (item === 'All' && !category)
                  ? 'text-brand-600 after:bg-brand-500'
                  : 'text-slate-500 after:bg-transparent hover:text-brand-600'
              }`}
            >
              {item}
            </a>
          ))}
        </nav>

        {vendors.length > 0 ? (
          <>
            <div className="flex items-center justify-between py-6">
              <p className="text-sm font-medium text-slate-700">{totalCount.toLocaleString()} artisan{totalCount === 1 ? '' : 's'} found</p>
            </div>
            <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
              {vendors.map((artisan, index) => <ProCard key={artisan.id} pro={artisan} index={index} />)}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Link
                  href={`/artisans?${new URLSearchParams({ ...(category ? { category } : {}), ...(state ? { state } : {}), ...(lga ? { lga } : {}), ...(search ? { search } : {}), page: String(currentPage + 1) }).toString()}`}
                  scroll={false}
                  className="btn-outline px-8 py-3"
                >
                  Load more ({totalCount - currentPage * PAGE_SIZE} remaining)
                </Link>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon="search" title="No artisans found" description="Try adjusting your filters or search terms" />
        )}
      </div>
    </main>
  )
}
