'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { jobPostSchema, type JobPostInput } from '@/lib/validators/job'
import { jobsApi } from '@/lib/api'
import { JOB_CATEGORIES, NIGERIAN_CITIES } from '@/types'

export default function PostJobPage() {
  const router = useRouter()
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JobPostInput>({ resolver: zodResolver(jobPostSchema) })

  async function onSubmit(data: JobPostInput) {
    const res = await jobsApi.create(data)
    if (res.success) {
      setSuccess(true)
      reset()
      setTimeout(() => router.push('/dashboard/jobs'), 1500)
    }
  }

  return (
    <>
      <div className="mb-5 sm:mb-7">
        <h1 className="font-display text-xl sm:text-2xl font-semibold">Post a Job</h1>
        <p className="text-sm text-slate-500 mt-1">Fill in the details to attract the right vendors</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-5 text-sm">
          ✅ Job posted successfully! Redirecting...
        </div>
      )}

      <div className="card w-full max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="label">Business Name *</label>
            <input
              {...register('businessName')}
              className={`input-field ${errors.businessName ? 'border-red-400' : ''}`}
              placeholder="e.g. Bright Spark Electrical"
            />
            {errors.businessName && <p className="mt-1.5 text-xs text-red-500">{errors.businessName.message}</p>}
          </div>

          <div className="form-group">
            <label className="label">Job Title *</label>
            <input
              {...register('title')}
              className={`input-field ${errors.title ? 'border-red-400' : ''}`}
              placeholder="e.g. Electrician"
            />
            {errors.title && <p className="mt-1.5 text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div className="form-group">
            <label className="label">Business Address *</label>
            <input
              {...register('businessAddress')}
              className={`input-field ${errors.businessAddress ? 'border-red-400' : ''}`}
              placeholder="e.g. 15 Adeola Odeku Street, Victoria Island, Lagos"
            />
            {errors.businessAddress && <p className="mt-1.5 text-xs text-red-500">{errors.businessAddress.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="form-group">
              <label className="label">Job Type *</label>
              <select
                {...register('jobType')}
                className={`input-field appearance-none ${errors.jobType ? 'border-red-400' : ''}`}
              >
                <option value="full-time">Full-time</option>
                <option value="contract">Contract</option>
              </select>
              {errors.jobType && <p className="mt-1.5 text-xs text-red-500">{errors.jobType.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Closing Date *</label>
              <input
                {...register('closingDate')}
                type="date"
                className={`input-field ${errors.closingDate ? 'border-red-400' : ''}`}
              />
              {errors.closingDate && <p className="mt-1.5 text-xs text-red-500">{errors.closingDate.message}</p>}
            </div>
          </div>

          <div className="form-group">
            <label className="label">Category *</label>
            <select
              {...register('category')}
              className={`input-field appearance-none ${errors.category ? 'border-red-400' : ''}`}
            >
              <option value="">Select a category</option>
              {JOB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="mt-1.5 text-xs text-red-500">{errors.category.message}</p>}
          </div>

          <div className="form-group">
            <label className="label">Description *</label>
            <textarea
              {...register('description')}
              rows={4}
              className={`input-field resize-y ${errors.description ? 'border-red-400' : ''}`}
              placeholder="Describe the job in detail..."
            />
            {errors.description && <p className="mt-1.5 text-xs text-red-500">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="form-group">
              <label className="label">Budget (₦) *</label>
              <input
                {...register('budget', { valueAsNumber: true })}
                type="number"
                inputMode="numeric"
                min="1000"
                className={`input-field ${errors.budget ? 'border-red-400' : ''}`}
                placeholder="50000"
              />
              {errors.budget && <p className="mt-1.5 text-xs text-red-500">{errors.budget.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Location *</label>
              <select
                {...register('city')}
                className={`input-field appearance-none ${errors.city ? 'border-red-400' : ''}`}
              >
                <option value="">Select city</option>
                {NIGERIAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.city && <p className="mt-1.5 text-xs text-red-500">{errors.city.message}</p>}
            </div>
          </div>

          <div className="form-group">
            <label className="label">Preferred Timeline</label>
            <select {...register('timeline')} className="input-field appearance-none">
              <option value="urgent">Urgent (within 48hrs)</option>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6 pt-4 border-t border-slate-200">
            <button type="submit" disabled={isSubmitting} className="btn-primary px-8 py-3 w-full sm:w-auto justify-center">
              {isSubmitting ? 'Posting...' : 'Post Job →'}
            </button>
            <button type="button" onClick={() => router.back()} className="btn-ghost px-6 py-3 w-full sm:w-auto justify-center">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
}