'use client'

import { useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { jobPostSchema, type JobPostInput } from '@/lib/validators/job'
import { jobsApi } from '@/lib/api'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { INDUSTRY_CATEGORIES } from '@/lib/registration-options'
import { NIGERIAN_STATE_NAMES } from '@/types'

export default function PostJobPage() {
  const { user, loading } = useCurrentUser()
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<JobPostInput>({
    resolver: zodResolver(jobPostSchema),
    defaultValues: { jobType: 'full-time', workArrangement: 'on-site', timeline: 'flexible' },
  })
  const shortDescriptionLength = watch('shortDescription', '').length
  const detailedDescriptionLength = watch('description', '').length

  async function onSubmit(data: JobPostInput) {
    const res = await jobsApi.create(data)
    if (res.success) {
      toast.success('Job posted')
      reset()
      timerRef.current = setTimeout(() => router.push('/dashboard/jobs'), 1500)
    } else {
      toast.error(res.error || 'Failed to post job')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sm text-slate-400">Loading...</div>
      </div>
    )
  }

  if (user?.role !== 'recruiter') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-slate-500 mb-4">Only verified recruiter accounts can post jobs.</p>
        <Link href="/jobs" className="text-sm text-brand-500 font-medium">
          Back to Jobs
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-5 rounded-lg border border-brand-100 bg-[linear-gradient(135deg,#ffffff_0%,#f2fbf8_100%)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:mb-7 sm:p-6">
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">Post a Job</h1>
        <p className="mt-1 text-sm text-slate-600">Create a clear brief so the right applicants know what you need.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
      <div className="card w-full">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-5 border-b border-slate-100 pb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">Job details</h2>
            <p className="mt-1 text-sm text-slate-500">Use plain, specific details. Shorter is better.</p>
          </div>

          <div className="form-group">
            <label className="label">Company Name *</label>
            <input
              {...register('businessName')}
                className={`input-field ${errors.businessName ? 'border-amber-300' : ''}`}
              placeholder="e.g. Bright Spark Electrical"
            />
            {errors.businessName && <p className="mt-1.5 text-xs text-amber-600">{errors.businessName.message}</p>}
          </div>

          <div className="form-group">
            <label className="label">Job Title *</label>
            <input
              {...register('title')}
                className={`input-field ${errors.title ? 'border-amber-300' : ''}`}
              />
              {errors.title && <p className="mt-1.5 text-xs text-amber-600">{errors.title.message}</p>}
          </div>

          <div className="form-group">
            <label className="label">Company Address *</label>
            <input
              {...register('businessAddress')}
                className={`input-field ${errors.businessAddress ? 'border-amber-300' : ''}`}
              />
              {errors.businessAddress && <p className="mt-1.5 text-xs text-amber-600">{errors.businessAddress.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <div className="form-group">
              <label className="label">Job Type *</label>
              <select
                {...register('jobType')}
                className={`input-field appearance-none ${errors.jobType ? 'border-amber-300' : ''}`}
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
                <option value="internship">Internship</option>
              </select>
              {errors.jobType && <p className="mt-1.5 text-xs text-amber-600">{errors.jobType.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Work Arrangement *</label>
              <select
                {...register('workArrangement')}
                className={`input-field appearance-none ${errors.workArrangement ? 'border-amber-300' : ''}`}
              >
                <option value="on-site">On-site</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
              {errors.workArrangement && <p className="mt-1.5 text-xs text-amber-600">{errors.workArrangement.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Closing Date *</label>
              <input
                {...register('closingDate')}
                type="date"
                className={`input-field ${errors.closingDate ? 'border-amber-300' : ''}`}
              />
              {errors.closingDate && <p className="mt-1.5 text-xs text-amber-600">{errors.closingDate.message}</p>}
            </div>
          </div>

          <div className="form-group">
            <label className="label">Industry *</label>
            <select
              {...register('category')}
              className={`input-field appearance-none ${errors.category ? 'border-amber-300' : ''}`}
            >
              <option value="">Select industry</option>
              {INDUSTRY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
              {errors.category && <p className="mt-1.5 text-xs text-amber-600">{errors.category.message}</p>}
          </div>

          <div className="form-group">
            <label className="label">Short Job Description *</label>
            <textarea
              {...register('shortDescription')}
              rows={3}
              minLength={60}
              maxLength={320}
              placeholder="Summarise the role and the most important requirement in 60–320 characters."
              className={`input-field resize-y ${errors.shortDescription ? 'border-amber-300' : ''}`}
            />
            <div className="mt-1 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">Displayed on every job card.</span>
              <span className={shortDescriptionLength > 320 ? 'text-red-600' : 'text-slate-400'}>{shortDescriptionLength}/320</span>
            </div>
            {errors.shortDescription && <p className="mt-1.5 text-xs text-amber-600">{errors.shortDescription.message}</p>}
          </div>

          <div className="form-group">
            <label className="label">Detailed Job Description *</label>
            <textarea
              {...register('description')}
              rows={10}
              minLength={200}
              maxLength={10000}
              placeholder="Describe responsibilities, requirements, qualifications, working arrangements, and what success in the role looks like."
              className={`input-field resize-y ${errors.description ? 'border-amber-300' : ''}`}
            />
            <div className="mt-1 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">Shown on the full job details page.</span>
              <span className="text-slate-400">{detailedDescriptionLength.toLocaleString()}/10,000</span>
            </div>
            {errors.description && <p className="mt-1.5 text-xs text-amber-600">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="form-group">
              <label className="label">Budget (₦) *</label>
              <input
                {...register('budget', { valueAsNumber: true })}
                type="number"
                inputMode="numeric"
                min="1000"
                className={`input-field ${errors.budget ? 'border-amber-300' : ''}`}
              />
              {errors.budget && <p className="mt-1.5 text-xs text-amber-600">{errors.budget.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Location *</label>
              <select
                {...register('city')}
                className={`input-field appearance-none ${errors.city ? 'border-amber-300' : ''}`}
              >
                <option value="">Select state</option>
                {NIGERIAN_STATE_NAMES.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
              {errors.city && <p className="mt-1.5 text-xs text-amber-600">{errors.city.message}</p>}
            </div>
          </div>

          <div className="form-group">
            <label className="label">Hiring Urgency / Timeline *</label>
            <select {...register('timeline')} className="input-field appearance-none">
              <option value="urgent">Urgent hiring (within 48 hours)</option>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6 pt-4 border-t border-slate-200">
            <button type="submit" disabled={isSubmitting} className="btn-primary px-8 py-3 w-full sm:w-auto justify-center">
              {isSubmitting ? 'Posting...' : 'Post Job'}
            </button>
            <button type="button" onClick={() => router.back()} className="btn-ghost px-6 py-3 w-full sm:w-auto justify-center">
              Cancel
            </button>
          </div>
        </form>
      </div>
      <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] lg:sticky lg:top-24 lg:self-start">
        <h2 className="font-display text-base font-semibold text-slate-900">Good posts include</h2>
        <div className="mt-4 space-y-3">
          {[
            'Clear role or task title',
            'Exact location or remote option',
            'Budget and closing date',
            'Company name and job summary',
            'Urgency or expected hiring timeline',
            'Skills or experience required',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </aside>
      </div>
    </>
  )
}
