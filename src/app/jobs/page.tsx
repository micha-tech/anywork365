import Link from 'next/link'
import { listVacancies } from '@/lib/queries'
import { vacancyRowToJob } from '@/lib/jobs'
import { EmptyState } from '@/components/ui'
import { NIGERIAN_STATE_NAMES } from '@/types'
import { INDUSTRY_CATEGORIES } from '@/lib/registration-options'
import { JobCard } from '@/components/forms/JobCard'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

interface Props {
  searchParams?: Promise<{ search?: string; category?: string; state?: string; page?: string }>
}

export default async function JobsPage({ searchParams }: Props) {
  const { search, category, state: city, page } = (await searchParams) ?? {}
  const currentPage = Math.max(1, parseInt(page || '1'))

  const vacancies = await listVacancies({
    search,
    location: city,
    job_type: category,
  })

  const allJobs = vacancies.map(vacancyRowToJob)

  const jobs = allJobs.slice(0, currentPage * PAGE_SIZE)
  const totalCount = allJobs.length
  const hasMore = totalCount > currentPage * PAGE_SIZE

  const loadMoreHref = `/jobs?${new URLSearchParams({ ...(search ? { search } : {}), ...(category ? { category } : {}), ...(city ? { state: city } : {}), page: String(currentPage + 1) }).toString()}`

  return (
    <div className="bg-surface-base">
      <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#FAFBFC_100%)] px-4 py-5 sm:px-6 sm:py-10">
        <div className="max-w-5xl mx-auto">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">Browse Jobs</h1>
            <p className="mt-2 text-sm text-slate-600">Open opportunities across Nigeria</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 py-4 sm:px-6 sm:py-8">
        <form className="mb-5 grid min-w-0 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:mb-6 sm:gap-3 sm:p-4" method="GET">
          <input
            name="search"
            defaultValue={search}
            className="input-field w-full"
            placeholder="Search by role, company, or keyword..."
          />
          <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select name="category" defaultValue={category} className="input-field min-w-0 appearance-none truncate">
              <option value="">All Categories</option>
              {INDUSTRY_CATEGORIES.map((categoryOption) => <option key={categoryOption} value={categoryOption}>{categoryOption}</option>)}
            </select>
            <select name="state" defaultValue={city} className="input-field min-w-0 appearance-none truncate">
              <option value="">All States</option>
              {NIGERIAN_STATE_NAMES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary px-5">Go</button>
          </div>
        </form>

        {jobs.length > 0 ? (
          <>
            <p className="text-sm text-slate-500 mb-3 sm:mb-4">{totalCount.toLocaleString()} jobs found</p>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {jobs.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6 sm:mt-8">
                <a href={loadMoreHref} className="btn-outline w-full max-w-sm px-5 py-3 sm:w-auto sm:px-8">
                  Load More ({totalCount - currentPage * PAGE_SIZE} remaining)
                </a>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon="jobs"
            title="No jobs found"
            description="Try different search terms or browse all jobs"
            action={<Link href="/jobs" className="btn-outline px-6">Clear filters</Link>}
          />
        )}
      </div>
    </div>
  )
}
