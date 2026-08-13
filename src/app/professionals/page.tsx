import { listProfessionalProfiles } from '@/lib/queries'
import { EmptyState } from '@/components/ui'
import { ProfessionalCard } from '@/components/professionals/ProfessionalCard'
import { INDUSTRY_CATEGORIES } from '@/lib/registration-options'
import { NIGERIAN_STATE_NAMES } from '@/types'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string; industry?: string; state?: string; page?: string }>
}) {
  const { search, industry, state, page } = (await searchParams) ?? {}
  const currentPage = Math.max(1, Number(page || '1'))
  const allProfessionals = await listProfessionalProfiles({ search, industry, location: state })
  const professionals = allProfessionals.slice(0, currentPage * PAGE_SIZE)
  const hasMore = allProfessionals.length > professionals.length

  return (
    <div className="bg-surface-base">
      <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#FAFBFC_100%)] px-4 py-5 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">Professionals</h1>
          <p className="mt-2 text-sm text-slate-600">Explore qualified professionals across industries and specialist services.</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
        <form method="GET" className="mb-6 grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input name="search" defaultValue={search} className="input-field" placeholder="Name, job title, or specialty" />
          <select name="industry" defaultValue={industry} className="input-field appearance-none">
            <option value="">All industries</option>
            {INDUSTRY_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select name="state" defaultValue={state} className="input-field appearance-none">
            <option value="">All states</option>
            {NIGERIAN_STATE_NAMES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="submit" className="btn-primary px-5">Search</button>
        </form>

        {professionals.length === 0 ? (
          <EmptyState icon="search" title="No professionals found" description="Try changing your search or filters." />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">{allProfessionals.length.toLocaleString()} professionals found</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {professionals.map((professional, index) => (
                <ProfessionalCard key={professional.uid} professional={professional} index={index} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <a href={`/professionals?${new URLSearchParams({ ...(search ? { search } : {}), ...(industry ? { industry } : {}), ...(state ? { state } : {}), page: String(currentPage + 1) }).toString()}`} className="btn-outline px-8 py-3">Load more</a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
