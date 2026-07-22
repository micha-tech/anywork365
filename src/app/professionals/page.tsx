import { listProfessionalProfiles } from '@/lib/queries'
import { getAvatarUrl } from '@/lib/avatar'
import { Avatar, Badge, EmptyState } from '@/components/ui'
import { INDUSTRY_CATEGORIES } from '@/lib/registration-options'
import { NIGERIAN_STATE_NAMES } from '@/types'
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
              {professionals.map((professional, index) => {
                const names = professional.full_name.trim().split(/\s+/)
                const initials = `${names[0]?.[0] || ''}${names[1]?.[0] || names[0]?.[1] || ''}`.toUpperCase()
                return (
                  <article key={professional.uid} className="card group relative flex h-full flex-col p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-md">
                    <Link
                      href={`/professionals/${encodeURIComponent(professional.uid)}`}
                      className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                      aria-label={`View ${professional.full_name}'s professional profile`}
                    />
                    <div className="flex items-start gap-3">
                      <Avatar src={getAvatarUrl(professional.profile_image)} initials={initials} size="lg" colorIndex={index} />
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-lg font-semibold text-slate-900">{professional.full_name}</h2>
                        <p className="text-sm font-medium text-brand-600">{professional.job_title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{[professional.lga, professional.state].filter(Boolean).join(', ')}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="green">{professional.professional_service_category}</Badge>
                      <Badge variant="gray">{professional.years_experience} years experience</Badge>
                    </div>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{professional.industry_category}</p>
                    {professional.bio && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{professional.bio}</p>}
                    <div className="mt-auto border-t border-slate-100 pt-4 text-sm">
                      <p className="text-slate-600"><span className="font-semibold">Education:</span> {professional.qualification}</p>
                      {professional.linkedin_or_portfolio_url && (
                        <a href={professional.linkedin_or_portfolio_url} target="_blank" rel="noreferrer" className="relative z-20 mt-3 inline-flex font-semibold text-brand-600 hover:text-brand-700">View LinkedIn or portfolio →</a>
                      )}
                      <Link
                        href={`/professionals/${encodeURIComponent(professional.uid)}`}
                        className="relative z-20 mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-brand-600"
                      >
                        View profile
                      </Link>
                    </div>
                  </article>
                )
              })}
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
