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
    <main className="page-shell">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
        <header className="relative overflow-hidden rounded-3xl bg-brand-800 p-6 text-white sm:p-9">
          <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-[#c9f58b]/15" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Find the right hands</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">Browse artisans by skill, location and experience.</p>
          </div>
          <Link href="/nearby" className="inline-flex min-h-11 w-fit items-center rounded-full bg-[#c9f58b] px-5 py-2 text-sm font-bold text-brand-900 transition-all hover:-translate-y-0.5 hover:bg-[#d8ffad]">Find nearby</Link>
          </div>
        </header>

        <div className="mt-8 sm:mt-10">
        <ProfessionalFilters category={category} state={state} lga={lga} search={search} />
        </div>

        <nav aria-label="Quick artisan categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {CATEGORIES.map((item) => (
            <a
              key={item}
              href={`/artisans?${new URLSearchParams({
                ...(item !== 'All' ? { category: item } : {}),
                ...(state ? { state } : {}),
                ...(lga ? { lga } : {}),
                ...(search ? { search } : {}),
              }).toString()}`}
              className={`flex min-h-10 flex-shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                category === item || (item === 'All' && !category)
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-brand-200 hover:text-brand-600'
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
