import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getVacanciesByRecruiter } from '@/lib/queries'
import { getVerifiedSession } from '@/lib/auth'
import { vacancyRowToJob } from '@/lib/jobs'
import { JobCard } from '@/components/forms/JobCard'

export const dynamic = 'force-dynamic'

const TABS = ['active', 'completed'] as const
type Tab = (typeof TABS)[number]

export default async function MyJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await getVerifiedSession()
  if (!session || session.role !== 'recruiter') redirect('/jobs')

  const { tab: rawTab } = await searchParams
  const currentTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'active'

  const jobs = (await getVacanciesByRecruiter(session.id)).map(vacancyRowToJob)

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
          <div key={job.id}>
            <JobCard job={job} showApply={false} />
            <div className="-mt-2 flex justify-end rounded-b-xl border border-t-0 border-slate-200 bg-white px-4 pb-3">
              <Link href={`/dashboard/applications?job=${job.id}`} className="text-sm font-semibold text-brand-600">
                View applications ({job.applicationCount})
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
