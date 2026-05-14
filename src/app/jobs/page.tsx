import Link from 'next/link'
import { listVacancies, getCompaniesByUid } from '@/lib/queries'
import { JobCard } from '@/components/forms/JobCard'
import { EmptyState } from '@/components/ui'
import { JOB_CATEGORIES, NIGERIAN_CITIES } from '@/types'
import type { Job, JobStatus, JobCategory } from '@/types'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams?: Promise<{ search?: string; category?: string; city?: string }>
}

function vacancyToJob(v: Awaited<ReturnType<typeof listVacancies>>[number], companyName?: string, companyAddress?: string): Job {
  return {
    id: String(v.vacancy_id),
    title: v.vacancy_title,
    description: v.job_description,
    category: 'Professional services' as JobCategory,
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
  const { search, category, city } = (await searchParams) ?? {}

  const vacancies = await listVacancies({
    search,
    location: city,
    job_type: category,
  })

  const jobs = await Promise.all(vacancies.map(async (v) => {
    const companies = await getCompaniesByUid(String(v.company_id))
    const company = companies[0]
    return vacancyToJob(v, company?.company_name ?? undefined, company?.company_address ?? undefined)
  }))

  return (
    <div>
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-5 sm:py-7">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-semibold mb-1">Browse Jobs</h1>
            <p className="text-sm text-slate-500">Open opportunities across Nigeria</p>
          </div>
          <Link href="/dashboard/post-job" className="btn-primary text-sm flex-shrink-0">
            + Post Job
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <form className="flex flex-col gap-2 sm:gap-3 mb-6" method="GET">
          <input
            name="search"
            defaultValue={search}
            className="input-field w-full"
          />
          <div className="flex gap-2">
            <select name="category" defaultValue={category} className="input-field flex-1 appearance-none">
              <option value="">All Categories</option>
              {JOB_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select name="city" defaultValue={city} className="input-field flex-1 appearance-none">
              <option value="">All Cities</option>
              {NIGERIAN_CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary px-5 flex-shrink-0">Go</button>
          </div>
        </form>

        {jobs.length > 0 ? (
          <>
            <p className="text-sm text-slate-500 mb-4">{jobs.length} jobs found</p>
            <div className="flex flex-col gap-3 sm:gap-4">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon="💼"
            title="No jobs found"
            description="Try different search terms or browse all jobs"
            action={<Link href="/jobs" className="btn-outline px-6">Clear filters</Link>}
          />
        )}
      </div>
    </div>
  )
}