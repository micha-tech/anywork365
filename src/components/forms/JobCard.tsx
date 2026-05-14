import Link from 'next/link'
import { Badge } from '@/components/ui'
import { timeAgo } from '@/lib/utils'
import type { Job } from '@/types'

interface JobCardProps {
  job: Job
  showApply?: boolean
}

export function JobCard({ job, showApply = true }: JobCardProps) {
  return (
    <div className="card hover:border-brand-500 transition-colors">
      <div className="flex items-start justify-end gap-2 mb-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          job.jobType === 'full-time' 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-purple-100 text-purple-700'
        }`}>
          {job.jobType === 'full-time' ? 'Full-time' : 'Contract'}
        </span>
      </div>

      <div className="flex items-start justify-between gap-3 mb-2">
        <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-900 hover:text-brand-500 transition-colors text-sm sm:text-base leading-snug">
            {job.title}
          </h3>
        </Link>
      </div>

      <p className="text-sm text-slate-500 line-clamp-1 mb-2">{job.businessName}</p>
      
      <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="line-clamp-1">{job.businessAddress}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200">
        <Badge variant="green">Open</Badge>
        {job.timeline === 'urgent' && <Badge variant="red">Urgent</Badge>}
        <span className="text-xs text-slate-500">
          {job.applicationCount} applicants
        </span>
        <span className="text-xs text-slate-500 ml-auto">
          Closes: {new Date(job.closingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {showApply && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 gap-3">
          <span className="text-xs text-slate-500 truncate">
            {timeAgo(job.createdAt)}
          </span>
          <Link
            href={`/jobs/${job.id}`}
            className="btn-primary text-xs px-4 py-2 min-h-[36px] flex-shrink-0"
          >
            Apply
          </Link>
        </div>
      )}
    </div>
  )
}