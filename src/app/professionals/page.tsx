import { listProfessionalProfiles } from '@/lib/queries'
import { EmptyState, SectionHeader } from '@/components/ui'
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
      <div className="w-full">
        <SectionHeader page title="Expertise for your next big idea" description="Meet skilled professionals and businesses. Explore their experience, services and work." />

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
