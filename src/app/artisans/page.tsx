import { listVendors } from '@/lib/queries'
import { ProCard } from '@/components/forms/ProCard'
import { ProfessionalFilters } from '@/components/forms/ProfessionalFilters'
import { EmptyState, SectionHeader } from '@/components/ui'
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
      <div className="w-full">
        <SectionHeader page title="Find the right hands" description="Local skills. People who can help. Find an artisan for the job you have in mind." action={<Link href="/nearby" className="btn-primary">Find nearby</Link>} />

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
              aria-current={category === item || (item === 'All' && !category) ? 'page' : undefined}
              className="segment"
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
