import Link from 'next/link'
import { listVacancies } from '@/lib/queries'
import { vacancyRowToJob } from '@/lib/jobs'
import { EmptyState, SectionHeader } from '@/components/ui'
import { NIGERIAN_STATE_NAMES } from '@/types'
import { INDUSTRY_CATEGORIES, JOB_LEVELS } from '@/lib/registration-options'
import { JobCard } from '@/components/forms/JobCard'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

interface Props {
  searchParams?: Promise<{ search?: string; category?: string; state?: string; level?: string; page?: string }>
}

export default async function JobsPage({ searchParams }: Props) {
  const { search, category, state: city, level, page } = (await searchParams) ?? {}
  const currentPage = Math.max(1, parseInt(page || '1'))

  const vacancies = await listVacancies({
    search,
    location: city,
    job_type: category,
    job_level: level,
  })

  const allJobs = vacancies.map(vacancyRowToJob)

  const jobs = allJobs.slice(0, currentPage * PAGE_SIZE)
  const totalCount = allJobs.length
  const hasMore = totalCount > currentPage * PAGE_SIZE

  const loadMoreHref = `/jobs?${new URLSearchParams({ ...(search ? { search } : {}), ...(category ? { category } : {}), ...(city ? { state: city } : {}), ...(level ? { level } : {}), page: String(currentPage + 1) }).toString()}`

  return (
    <div className="page-shell">
      <div className="pt-0">
        <div className="max-w-5xl mx-auto">
          <SectionHeader page title="Make your next move" description="From your first internship to your next challenge. Find an opportunity that fits." />
        </div>
      </div>

      <div className="max-w-5xl mx-auto py-4">
        <form className="soft-panel mb-5 grid min-w-0 gap-2 p-3 sm:mb-6 sm:gap-3 sm:p-4" method="GET">
          <input
            aria-label="Search jobs"
            name="search"
            defaultValue={search}
            className="input-field w-full"
            placeholder="Search by role, company, or keyword..."
          />
          <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select aria-label="Industry" name="category" defaultValue={category} className="input-field min-w-0 appearance-none truncate">
              <option value="">All Categories</option>
              {INDUSTRY_CATEGORIES.map((categoryOption) => <option key={categoryOption} value={categoryOption}>{categoryOption}</option>)}
            </select>
            <select aria-label="State" name="state" defaultValue={city} className="input-field min-w-0 appearance-none truncate">
              <option value="">All States</option>
              {NIGERIAN_STATE_NAMES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select aria-label="Job level" name="level" defaultValue={level} className="input-field min-w-0 appearance-none truncate">
              <option value="">All job levels</option>
              {JOB_LEVELS.map((item) => <option key={item} value={item}>{item === 'entry-level' ? 'Entry level' : item === 'mid-level' ? 'Mid level' : item === 'senior-level' ? 'Senior level' : item.charAt(0).toUpperCase() + item.slice(1)}</option>)}
            </select>
            <button type="submit" className="btn-primary px-5">Go</button>
          </div>
        </form>

        <nav className="segment-list mb-6" aria-label="Job categories">
          <Link href="/jobs" aria-current={!level ? 'page' : undefined} className="segment">All jobs</Link>
          {JOB_LEVELS.map(item => <Link key={item} href={`/jobs?level=${item}`} aria-current={level === item ? 'page' : undefined} className="segment">
            {item === 'internship' ? 'Internships' : item === 'entry-level' ? 'Entry level' : item === 'mid-level' ? 'Mid level' : item === 'senior-level' ? 'Senior level' : 'Executive'}
          </Link>)}
        </nav>

        {jobs.length > 0 ? (
          <>
            <p className="text-sm text-slate-500 mb-3 sm:mb-4">{totalCount.toLocaleString()} jobs found</p>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {jobs.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6 sm:mt-8">
                <Link href={loadMoreHref} scroll={false} className="btn-outline w-full max-w-sm px-5 py-3 sm:w-auto sm:px-8">
                  Load More ({totalCount - currentPage * PAGE_SIZE} remaining)
                </Link>
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
