import Link from 'next/link'
import { Badge } from '@/components/ui'
import { timeAgo } from '@/lib/utils'
import { formatJobBudget } from '@/lib/jobs'
import type { Job } from '@/types'

interface JobCardProps {
  job: Job
  showApply?: boolean
}

function formatOption(value: string): string {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('-')
}

export function JobCard({ job, showApply = true }: JobCardProps) {
  const postedDate = new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const deadlineDate = job.closingDate
    ? new Date(job.closingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Open until filled'

  return (
    <div className={`card min-w-0 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-md sm:p-5 ${
      job.timeline === 'urgent' ? 'border-l-4 border-l-red-500' : ''
    }`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold border ${
          job.jobType === 'full-time'
            ? 'bg-blue-50 text-blue-700 border-blue-100'
            : 'bg-purple-50 text-purple-700 border-purple-100'
        }`}>
          {formatOption(job.jobType)}
        </span>
        {job.timeline === 'urgent' && <Badge variant="red">Urgent hiring</Badge>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
          {formatOption(job.workArrangement)}
        </span>
      </div>

      <div className="flex items-start justify-between gap-3 mb-2">
        <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-900 hover:text-brand-500 transition-colors text-sm sm:text-base leading-snug">
            {job.title}
          </h3>
        </Link>
      </div>

      <p className="mb-2 text-sm font-medium text-slate-600">
        <span className="font-normal text-slate-400">Company:</span> {job.businessName}
      </p>

      <p className="mb-3 line-clamp-3 text-sm leading-5 text-slate-600">{job.shortDescription}</p>

      <p className="mb-3 text-sm font-semibold text-brand-700">
        <span className="font-normal text-slate-400">Budget range:</span> {formatJobBudget(job)}
      </p>
      
      <div className="mb-3 flex min-w-0 items-center gap-1 text-xs text-slate-500">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="line-clamp-1">{job.businessAddress}</span>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Badge variant="green">Open</Badge>
        <span className="text-xs text-slate-500">
          {job.applicationCount} applicants
        </span>
        <span className="text-xs text-slate-500 sm:ml-auto">Deadline: {deadlineDate}</span>
      </div>

      <p className="mt-2 text-xs text-slate-500">Posted: {postedDate} ({timeAgo(job.createdAt)})</p>

      {showApply && (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500 truncate">Applications close {deadlineDate}</span>
          <Link
            href={`/jobs/${job.id}`}
            className="btn-primary min-h-[36px] flex-shrink-0 px-4 py-2 text-xs"
          >
            Apply
          </Link>
        </div>
      )}
    </div>
  )
}
