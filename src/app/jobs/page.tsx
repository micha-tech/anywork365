import Link from 'next/link'
import { listVacancies } from '@/lib/queries'
import { query } from '@/lib/db'
import { EmptyState } from '@/components/ui'
import { BUSINESS_CATEGORY_GROUPS, NIGERIAN_STATE_NAMES } from '@/types'
import type { Job, JobStatus, JobCategory } from '@/types'
import type { RowDataPacket } from 'mysql2'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

interface Props {
  searchParams?: Promise<{ search?: string; category?: string; state?: string; page?: string }>
}

interface CompanyRow extends RowDataPacket {
  company_id: number
  company_name: string
  company_address: string | null
}

function vacancyToJob(v: Awaited<ReturnType<typeof listVacancies>>[number], companyName?: string, companyAddress?: string): Job {
  return {
    id: String(v.vacancy_id),
    title: v.vacancy_title,
    description: v.job_description,
    category: 'Business Registration & Corporate Services' as JobCategory,
    budget: 0,
    city: v.vacancy_location,
    status: v.closed ? 'completed' as JobStatus : 'open' as JobStatus,
    timeline: 'flexible',
    posterId: '',
    posterName: companyName || '',
    businessName: companyName || '',
    businessAddress: companyAddress || '',
    jobType: v.work_type === 'Remote' ? 'contract' as const : 'full-time' as const,
    closingDate: v.closing_date || '',
    applicationCount: 0,
    createdAt: v.date_created,
  }
}

export default async function JobsPage({ searchParams }: Props) {
  const { search, category, state: city, page } = (await searchParams) ?? {}
  const currentPage = Math.max(1, parseInt(page || '1'))

  const vacancies = await listVacancies({
    search,
    location: city,
    job_type: category,
  })

  const ids = vacancies.map((v) => v.company_id).filter(Boolean)
  const companyMap: Record<number, { name: string; address: string }> = {}
  if (ids.length > 0) {
    const companies = await query<CompanyRow[]>(
      `SELECT company_id, company_name, company_address FROM companies WHERE company_id IN (${ids.map(() => '?').join(',')})`,
      ids
    )
    for (const c of companies) {
      companyMap[c.company_id] = { name: c.company_name, address: c.company_address || '' }
    }
  }

  const allJobs = vacancies.map((v) => {
    const company = companyMap[v.company_id]
    return vacancyToJob(v, company?.name, company?.address)
  })

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
              {BUSINESS_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.categories.map((categoryOption) => (
                    <option key={categoryOption} value={categoryOption}>{categoryOption}</option>
                  ))}
                </optgroup>
              ))}
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
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="card min-w-0 p-4 transition-all duration-200 hover:border-brand-300 hover:shadow-card-md sm:p-5"
                >
                  <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                    <span className={`flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${job.jobType === 'full-time' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                      {job.jobType === 'full-time' ? 'Full-time' : 'Contract'}
                    </span>
                    {job.closingDate && (
                      <span className="min-w-0 truncate text-right text-xs text-slate-400">
                        Closes {new Date(job.closingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 line-clamp-1 mb-1">{job.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-1 mb-2">{job.businessName}</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="line-clamp-1">{job.businessAddress || job.city}</span>
                  </div>
                </Link>
              ))}
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
