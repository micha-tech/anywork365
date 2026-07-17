import { listVendors } from '@/lib/queries'
import { ProCard } from '@/components/forms/ProCard'
import { ProfessionalFilters } from '@/components/forms/ProfessionalFilters'
import { EmptyState } from '@/components/ui'

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

interface Props {
  searchParams?: Promise<{ category?: string; state?: string; lga?: string; search?: string; page?: string }>
}

export default async function ProfessionalsPage({ searchParams }: Props) {
  const { category, state, lga, search, page } = (await searchParams) ?? {}
  const currentPage = Math.max(1, parseInt(page || '1'))

  const allVendors = await listVendors({ category, state, lga, search })
  const vendors = allVendors.slice(0, currentPage * PAGE_SIZE)
  const totalCount = allVendors.length
  const hasMore = totalCount > currentPage * PAGE_SIZE

  return (
    <div className="bg-surface-base">
      <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#FAFBFC_100%)] px-4 py-5 sm:px-6 sm:py-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">Vendors</h1>
            <p className="mt-2 text-sm text-slate-600">{totalCount.toLocaleString()} vendors ready for booking</p>
          </div>
          <div className="inline-flex w-fit max-w-full items-center truncate rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-600 sm:text-sm">
            Verified professionals
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 py-4 sm:px-6 sm:py-8">
        <ProfessionalFilters category={category} state={state} lga={lga} search={search} />

        <div className="flex gap-2 mb-5 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:mb-8 sm:px-0 sm:flex-wrap scrollbar-none">
          {CATEGORIES.map((cat) => (
            <a
              key={cat}
              href={`/professionals?${new URLSearchParams({
                ...(cat !== 'All' ? { category: cat } : {}),
                ...(state ? { state } : {}),
                ...(lga ? { lga } : {}),
                ...(search ? { search } : {}),
              }).toString()}`}
              className={`flex min-h-[38px] max-w-[78vw] flex-shrink-0 items-center truncate rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:max-w-none sm:px-4 ${
                (category === cat) || (cat === 'All' && !category)
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-brand-500 hover:text-brand-500'
              }`}
            >
              {cat}
            </a>
          ))}
        </div>

        {vendors.length > 0 ? (
          <>
            <p className="text-sm text-slate-500 mb-3 sm:mb-4">{totalCount.toLocaleString()} vendors found</p>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {vendors.slice(0, currentPage * PAGE_SIZE).map((pro, i) => (
                <ProCard key={pro.id} pro={pro} index={i} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6 sm:mt-8">
                <a
                  href={`/professionals?${new URLSearchParams({ ...(category ? { category } : {}), ...(state ? { state } : {}), ...(lga ? { lga } : {}), ...(search ? { search } : {}), page: String(currentPage + 1) }).toString()}`}
                  className="btn-outline w-full max-w-sm px-5 py-3 sm:w-auto sm:px-8"
                >
                  Load More ({totalCount - currentPage * PAGE_SIZE} remaining)
                </a>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon="search"
            title="No vendors found"
            description="Try adjusting your filters or search terms"
          />
        )}
      </div>
    </div>
  )
}
