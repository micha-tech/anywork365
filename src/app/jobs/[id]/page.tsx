'use client'

import { use, useState, useEffect } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { JobApplicationForm } from '@/components/jobs/JobApplicationForm'
import { timeAgo } from '@/lib/utils'
import { formatJobBudget } from '@/lib/jobs'
import type { Job } from '@/types'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { withAuthRedirect } from '@/lib/auth-redirect'

type ApplicationGate = 'signed-out' | 'unverified' | 'wrong-role' | null

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [applyOpen, setApplyOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [applicationGate, setApplicationGate] = useState<ApplicationGate>(null)
  const { user, loading: userLoading } = useCurrentUser()
  const applicationReturnPath = `/jobs/${id}?apply=1`

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setJob(d.data)
      })
      .catch(() => console.error('Failed to load job', id))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('apply') !== '1') return

    params.delete('apply')
    const nextSearch = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`)
    openApplication()
  }, [userLoading])

  const getVisitorId = (): string | null => {
    if (typeof document === 'undefined') return null
    return document.cookie.replace(/(?:(?:^|.*)\visitor_id\s*\=\s*([^;]*).*$)|^.*$/, '$1') || null
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const visitorId = getVisitorId()
    const uid = user?.id || visitorId
    fetch(`/api/jobs/${id}/apply`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => {
        if (body?.success && body.data?.hasApplied) setSubmitted(true)
      })
      .catch(() => undefined)
  }, [id, user])

  function openApplication() {
    if (userLoading) return
    if (!user) {
      setApplyOpen(true)
      return
    }
    if (!user.emailVerified) {
      setApplicationGate('unverified')
      return
    }
    setApplicationGate(null)
    setApplyOpen(true)
  }

  if (!loading && !job) notFound()
  if (loading || !job) return <div className="max-w-4xl mx-auto px-4 py-10"><div className="animate-pulse h-40 bg-gray-100 rounded-2xl" /></div>

  const postedDate = new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const deadlineDate = job.closingDate
    ? new Date(job.closingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Open until filled'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-500 mb-5">
        ← Back to Jobs
      </Link>

      <div className="sm:hidden bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">Budget range</p>
          <p className="text-xl font-semibold text-brand-500">{formatJobBudget(job)}</p>
        </div>
        <button
          onClick={openApplication}
          disabled={submitted || userLoading}
          className="btn-primary px-6 py-2.5 flex-shrink-0"
        >
          {submitted ? (
          <>
            <p className="text-sm text-slate-600">Application submitted successfully!</p>
            <p className="text-sm text-slate-500 mt-1">Recruiter has been notified. <a href="/signup/professional" className="font-medium text-brand-600 underline">Create an account</a> to save your application and get updates.</p>
          </>
        ) : userLoading ? 'Checking...' : 'Apply Now'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-5">
          <div className="card">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="font-display text-lg sm:text-xl font-semibold text-slate-900 leading-snug">
                {job.title}
              </h1>
              <Badge variant={job.status === 'open' ? 'green' : 'gray'} className="flex-shrink-0 capitalize">
                {job.status}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="gray">{job.category}</Badge>
              {job.timeline === 'urgent' && <Badge variant="red">Urgent</Badge>}
              <span className="text-xs text-slate-500 flex items-center">{timeAgo(job.createdAt)}</span>
            </div>

            <h2 className="font-medium text-sm mb-2">Job Description</h2>
            <p className="text-sm text-slate-500 leading-relaxed">{job.description}</p>
          </div>

          <div className="card">
            <h2 className="font-medium text-sm mb-3">What we&apos;re looking for</h2>
            <ul className="space-y-2.5 text-sm text-slate-500">
              {[
                'Verified and licensed professional',
                `Minimum 2 years experience in ${job.category}`,
                `Available in ${job.city}`,
                job.timeline === 'urgent' ? 'Can start within 48 hours' : 'Reliable and communicative',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-brand-500 mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="hidden sm:flex flex-col gap-5">
          <div className="card">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Budget range</p>
            <p className="font-display text-2xl font-semibold text-brand-500 mb-4">
              {formatJobBudget(job)}
            </p>
            <div className="space-y-2 text-sm mb-5">
              {[
                { label: 'Employment type', value: job.jobType.replace('-', ' ') },
                { label: 'Work arrangement', value: job.workArrangement.replace('-', ' ') },
                { label: 'Job level', value: job.jobLevel.replace('-', ' ') },
                { label: 'Location',    value: job.city },
                { label: 'Timeline',   value: job.timeline.replace('_', ' ') },
                { label: 'Applicants', value: String(job.applicationCount) },
                { label: 'Posted by',  value: job.posterName },
                { label: 'Posted', value: postedDate },
                { label: 'Deadline', value: deadlineDate },
              ].map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-slate-500">{r.label}</span>
                  <span className="font-medium capitalize">{r.value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={openApplication}
              disabled={submitted || userLoading}
              className="btn-primary w-full py-3 justify-center"
            >
              {submitted ? (
          <>
            <p className="text-sm text-slate-600">Application submitted successfully!</p>
            <p className="text-sm text-slate-500 mt-1">Recruiter has been notified. <a href="/signup/professional" className="font-medium text-brand-600 underline">Create an account</a> to save your application and get updates.</p>
          </>
        ) : userLoading ? 'Checking account...' : 'Apply for this job'}
            </button>
            <button className="btn-ghost w-full py-2.5 justify-center mt-2">Save job</button>
          </div>

          <div className="card">
            <h3 className="font-medium text-sm mb-3">About the Recruiter</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {job.posterName[0]}
              </div>
              <div>
                <p className="text-sm font-medium">{job.posterName}</p>
                <p className="text-xs text-slate-500">{job.city}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Applications are delivered directly to this recruiter.</p>
          </div>
        </div>
      </div>

      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="Apply for this job" size="lg">
        <JobApplicationForm
          jobId={job.id}
          onCancel={() => setApplyOpen(false)}
          onAccessRequired={(reason) => {
            setApplyOpen(false)
            setApplicationGate(reason)
          }}
onSubmitted={() => {
    setSubmitted(true)
    setApplyOpen(false)
    // Prompt visitor to create account after successful application
    setTimeout(() => {
      // Show account creation prompt - will be handled by UI state
    }, 100)
  }}
        />
      </Modal>

      <Modal
        open={applicationGate !== null}
        onClose={() => setApplicationGate(null)}
        title={applicationGate === 'signed-out'
          ? 'Sign in before you apply'
          : applicationGate === 'unverified'
            ? 'Verify your email first'
            : 'Applicant account required'}
        size="sm"
      >
        <div className="space-y-5">
          {applicationGate === 'signed-out' && (
            <>
              <p className="text-sm leading-6 text-slate-600">
                Sign in before completing the application form. We&apos;ll bring you straight back to this job when you&apos;re done.
              </p>
              <div className="space-y-3">
                <Link href={withAuthRedirect('/login', applicationReturnPath)} className="btn-primary flex w-full justify-center py-3">
                  Log in and continue
                </Link>
                <Link href={withAuthRedirect('/signup/professional', applicationReturnPath)} className="btn-secondary flex w-full justify-center py-3">
                  Create a professional account
                </Link>
              </div>
              <p className="text-center text-xs text-slate-500">Artisan accounts can also apply after logging in.</p>
            </>
          )}

          {applicationGate === 'unverified' && (
            <>
              <p className="text-sm leading-6 text-slate-600">
                Confirm <strong className="font-semibold text-slate-900">{user?.email}</strong> before applying. After verification, you&apos;ll return to this job automatically.
              </p>
              <Link href={withAuthRedirect('/verify-email', applicationReturnPath)} className="btn-primary flex w-full justify-center py-3">
                Verify email and continue
              </Link>
            </>
          )}

          {applicationGate === 'wrong-role' && (
            <>
              <p className="text-sm leading-6 text-slate-600">
                Job applications are available to artisan and professional accounts. You are currently signed in with a <strong className="font-semibold capitalize text-slate-900">{user?.role}</strong> account.
              </p>
              <button type="button" onClick={() => setApplicationGate(null)} className="btn-secondary w-full justify-center py-3">
                Return to job
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
