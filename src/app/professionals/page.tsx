import { listVendors } from '@/lib/queries'
import { ProCard } from '@/components/forms/ProCard'
import { EmptyState } from '@/components/ui'
import { JOB_CATEGORIES, NIGERIAN_CITIES } from '@/types'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['All', ...JOB_CATEGORIES]

const PAGE_SIZE = 12

interface Props {
  searchParams?: Promise<{ category?: string; city?: string; search?: string; page?: string }>
}

export default async function ProfessionalsPage({ searchParams }: Props) {
  const { category, city, search, page } = (await searchParams) ?? {}
  const currentPage = Math.max(1, parseInt(page || '1'))
  const offset = (currentPage - 1) * PAGE_SIZE

  const allVendors = await listVendors({ category, state: city, search })
  const vendors = allVendors.slice(0, currentPage * PAGE_SIZE)
  const totalCount = allVendors.length
  const hasMore = totalCount > currentPage * PAGE_SIZE

  return (
    <div>
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-5 sm:py-7">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-display text-xl sm:text-2xl font-semibold mb-1">Find Vendors</h1>
          <p className="text-sm text-slate-500">{totalCount.toLocaleString()}+ verified vendors across Nigeria</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <form className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5 sm:mb-6" method="GET">
          <input
            name="search"
            defaultValue={search}
            className="input-field flex-1"
            placeholder="Search by skill, name, or keyword..."
          />
          <div className="flex gap-2">
            <select name="city" defaultValue={city} className="input-field flex-1 sm:w-44 appearance-none">
              <option value="">All Cities</option>
              {NIGERIAN_CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary px-5 flex-shrink-0">Search</button>
          </div>
        </form>

        <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-none">
          {CATEGORIES.map((cat) => (
            <a
              key={cat}
              href={cat === 'All' ? '/professionals' : `/professionals?category=${cat}`}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors flex-shrink-0 min-h-[36px] flex items-center ${
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
            <p className="text-sm text-slate-500 mb-4">{totalCount.toLocaleString()} vendors found</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {vendors.slice(0, currentPage * PAGE_SIZE).map((pro, i) => (
                <ProCard key={pro.id} pro={pro} index={i} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6 sm:mt-8">
                <a
                  href={`/professionals?${new URLSearchParams({ ...(category ? { category } : {}), ...(city ? { city } : {}), ...(search ? { search } : {}), page: String(currentPage + 1) }).toString()}`}
                  className="btn-outline px-8 py-3"
                >
                  Load More ({totalCount - currentPage * PAGE_SIZE} remaining)
                </a>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon="🔍"
            title="No vendors found"
            description="Try adjusting your filters or search terms"
          />
        )}
      </div>
    </div>
  )
}