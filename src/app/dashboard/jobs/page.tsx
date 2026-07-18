import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCompaniesByUid } from '@/lib/queries'
import { query } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { JobCard } from '@/components/forms/JobCard'
import type { Job } from '@/types'
import type { RowDataPacket } from 'mysql2'

export const dynamic = 'force-dynamic'

const TABS = ['active', 'completed'] as const
type Tab = (typeof TABS)[number]

export default async function MyJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await getSession()
  if (!session || session.role !== 'artisan') redirect('/dashboard')

  const { tab: rawTab } = await searchParams
  const currentTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'active'

  const companies = await getCompaniesByUid(session.id)
  const companyIds = companies.map((c) => c.company_id)

  let allVacancies: any[] = []
  if (companyIds.length > 0) {
    interface VacancyRow extends RowDataPacket {
      vacancy_id: number
      company_id: number
      vacancy_title: string
      vacancy_location: string
      job_type: string
      work_type: string
      years_of_experience: number | null
      required_skills: string
      job_description: string
      closing_date: string | null
      date_created: string
      closed: number
    }
    const placeholders = companyIds.map(() => '?').join(',')
    allVacancies = await query<VacancyRow[]>(
      `SELECT * FROM vacancies WHERE company_id IN (${placeholders}) ORDER BY date_created DESC LIMIT 200`,
      companyIds
    )
  }

  const vacancies = allVacancies

  const ids = vacancies.map((v) => v.company_id).filter(Boolean)
  const companyMap: Record<number, { name: string; address: string }> = {}
  if (ids.length > 0) {
    interface CompanyRow extends RowDataPacket {
      company_id: number
      company_name: string
      company_address: string | null
    }
    const companyRows = await query<CompanyRow[]>(
      `SELECT company_id, company_name, company_address FROM companies WHERE company_id IN (${ids.map(() => '?').join(',')})`,
      ids
    )
    for (const c of companyRows) {
      companyMap[c.company_id] = { name: c.company_name, address: c.company_address || '' }
    }
  }

  const jobs: Job[] = vacancies.map((v) => {
    const company = companyMap[v.company_id]
    return {
      id: String(v.vacancy_id),
      title: v.vacancy_title,
      description: v.job_description,
      category: (v.work_type === 'Remote' ? 'Website & App Development' : 'General Services') as Job['category'],
      budget: 0,
      city: v.vacancy_location,
      status: v.closed ? ('completed' as Job['status']) : ('open' as Job['status']),
      timeline: 'flexible',
      posterId: '',
      posterName: '',
      businessName: company?.name || '',
      businessAddress: company?.address || '',
      jobType: v.work_type === 'Remote' ? 'contract' : 'full-time',
      closingDate: v.closing_date || '',
      applicationCount: 0,
      createdAt: v.date_created,
    }
  })

  const filtered = currentTab === 'active'
    ? jobs.filter((j) => j.status === 'open')
    : jobs.filter((j) => j.status === 'completed')
  const activeCount = jobs.filter((j) => j.status === 'open').length
  const completedCount = jobs.filter((j) => j.status === 'completed').length

  return (
    <>
      <div className="mb-5 rounded-lg border border-brand-100 bg-[linear-gradient(135deg,#ffffff_0%,#f2fbf8_100%)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:mb-7 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">Posted Jobs</h1>
            <p className="mt-1 text-sm text-slate-600">Manage hiring posts connected to your business.</p>
          </div>
          <Link href="/dashboard/post-job" className="btn-primary text-sm flex-shrink-0">Post job</Link>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Active</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-600">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Completed</p>
          <p className="mt-1 font-display text-2xl font-bold text-green-700">{completedCount}</p>
        </div>
      </div>

      <div className="flex gap-0 border-b border-slate-200 mb-5 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/jobs?tab=${tab}`}
            className={`px-4 sm:px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0 capitalize ${
              tab === currentTab
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab} ({jobs.filter((j) => tab === 'active' ? j.status === 'open' : j.status === 'completed').length})
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
            <p className="text-sm font-semibold text-slate-900">No {currentTab} jobs</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              {currentTab === 'active' ? 'Post a hiring job when you need extra hands.' : 'Closed jobs will appear here.'}
            </p>
            {currentTab === 'active' && (
              <Link href="/dashboard/post-job" className="btn-primary mt-4 px-5 py-2.5 text-sm">
                Post job
              </Link>
            )}
          </div>
        ) : filtered.map((job) => (
          <JobCard key={job.id} job={job} showApply={false} />
        ))}
      </div>
    </>
  )
}
