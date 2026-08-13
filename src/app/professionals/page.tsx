import { listProfessionalProfiles } from '@/lib/queries'
import { EmptyState } from '@/components/ui'
import { ProfessionalCard } from '@/components/professionals/ProfessionalCard'
import { ProfessionalDirectoryFilters } from '@/components/professionals/ProfessionalDirectoryFilters'

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
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">Professionals</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Discover professionals across industries, roles and specialist services.</p>
        </header>

        <ProfessionalDirectoryFilters search={search} industry={industry} state={state} />

        {professionals.length === 0 ? (
          <EmptyState icon="search" title="No professionals found" description="Try changing your search or filters." />
        ) : (
          <>
            <div className="flex items-center justify-between py-6">
              <p className="text-sm font-medium text-slate-700">{allProfessionals.length.toLocaleString()} professional{allProfessionals.length === 1 ? '' : 's'} found</p>
            </div>
            <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
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
    </main>
  )
}
