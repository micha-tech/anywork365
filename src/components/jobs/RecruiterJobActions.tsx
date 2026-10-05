'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { jobsApi } from '@/lib/api'

export function RecruiterJobActions({ jobId, applicationCount }: { jobId: string; applicationCount: number }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function deleteJob() {
    if (!window.confirm('Delete this job post permanently? This cannot be undone.')) return
    setDeleting(true)
    const response = await jobsApi.delete(jobId)
    if (response.success) {
      toast.success('Job post deleted')
      router.refresh()
    } else {
      toast.error(response.error || 'Could not delete job post')
    }
    setDeleting(false)
  }

  return <div className="-mt-2 flex flex-wrap items-center justify-end gap-4 rounded-b-xl border border-t-0 border-slate-200 bg-white px-4 pb-3">
    <Link href={`/dashboard/post-job?edit=${jobId}`} className="text-sm font-semibold text-brand-600">Edit job</Link>
    <Link href={`/dashboard/applications?job=${jobId}`} className="text-sm font-semibold text-brand-600">View applications ({applicationCount})</Link>
    {applicationCount === 0 ? <button type="button" onClick={deleteJob} disabled={deleting} className="text-sm font-semibold text-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete job'}</button> : <span className="text-xs text-slate-500">Deletion disabled after applications arrive</span>}
  </div>
}
