import { listProfessionalProfiles } from '@/lib/queries'
import { EmptyState } from '@/components/ui'
import { ProfessionalCard } from '@/components/professionals/ProfessionalCard'
import { ProfessionalDirectoryFilters } from '@/components/professionals/ProfessionalDirectoryFilters'
import Link from 'next/link'

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
    <main className="page-shell">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
        <header className="relative overflow-hidden rounded-3xl bg-[#efffde] p-6 sm:p-9">
          <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-[#c9f58b]/55" />
          <h1 className="relative page-heading text-brand-900">Meet your next great hire</h1>
          <p className="relative page-intro text-brand-800/70">Explore professionals across industries, roles and specialist services.</p>
        </header>

        <ProfessionalDirectoryFilters search={search} industry={industry} state={state} />

        {professionals.length === 0 ? (
          <EmptyState icon="search" title="No professionals found" description="Try changing your search or filters." />
        ) : (
          <>
            <div className="flex items-center justify-between py-6">
              <p className="text-sm font-medium text-slate-700">{allProfessionals.length.toLocaleString()} professional{allProfessionals.length === 1 ? '' : 's'} found</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {professionals.map((professional, index) => (
                <ProfessionalCard key={professional.uid} professional={professional} index={index} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Link
                  href={`/professionals?${new URLSearchParams({ ...(search ? { search } : {}), ...(industry ? { industry } : {}), ...(state ? { state } : {}), page: String(currentPage + 1) }).toString()}`}
                  scroll={false}
                  className="btn-outline px-8 py-3"
                >
                  Load more
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
