import { listVendors } from '@/lib/queries'
import { ProCard } from '@/components/forms/ProCard'
import { ProfessionalFilters } from '@/components/forms/ProfessionalFilters'
import { EmptyState } from '@/components/ui'
import Link from 'next/link'
import { ArtisanLiveLocation } from '@/components/location/ArtisanLiveLocation'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  'All',
  'Carpentry & Furniture',
  'Painting & Wall Finishing',
  'Auto Mechanics',
  'Plumbing Services',
  'Tailoring & Fashion Design',
  'Legal Consultancy',
  'Freight Forwarding / Clearing Agents',
  'Home Tutors',
  'Logistics / Transportation Services',
  'Technical Engineering Services',
  'Digital Printing Services',
  'Tax / Accounting Consultancy',
  'Quantity Surveying',
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
    <div className="bg-surface-base">
      <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#FAFBFC_100%)] px-4 py-5 sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">Artisans</h1>
            <p className="mt-2 text-sm text-slate-600">{totalCount.toLocaleString()} artisan{totalCount === 1 ? '' : 's'} listed</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/nearby" className="btn-primary px-4 py-2 text-sm">Artisans near me</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
        <div className="mb-4"><ArtisanLiveLocation /></div>
        <ProfessionalFilters category={category} state={state} lga={lga} search={search} />
        <div className="-mx-3 mb-5 flex gap-2 overflow-x-auto px-3 pb-2 sm:mx-0 sm:mb-8 sm:flex-wrap sm:px-0">
          {CATEGORIES.map((item) => (
            <a
              key={item}
              href={`/artisans?${new URLSearchParams({
                ...(item !== 'All' ? { category: item } : {}),
                ...(state ? { state } : {}),
                ...(lga ? { lga } : {}),
                ...(search ? { search } : {}),
              }).toString()}`}
              className={`flex min-h-[38px] flex-shrink-0 items-center rounded-lg border px-3 py-2 text-sm font-medium ${
                category === item || (item === 'All' && !category)
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-brand-500 hover:text-brand-500'
              }`}
            >
              {item}
            </a>
          ))}
        </div>

        {vendors.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-slate-500">{totalCount.toLocaleString()} artisans found</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {vendors.map((artisan, index) => <ProCard key={artisan.id} pro={artisan} index={index} />)}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <a href={`/artisans?${new URLSearchParams({ ...(category ? { category } : {}), ...(state ? { state } : {}), ...(lga ? { lga } : {}), ...(search ? { search } : {}), page: String(currentPage + 1) }).toString()}`} className="btn-outline px-8 py-3">
                  Load more ({totalCount - currentPage * PAGE_SIZE} remaining)
                </a>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon="search" title="No artisans found" description="Try adjusting your filters or search terms" />
        )}
      </div>
    </div>
  )
}
