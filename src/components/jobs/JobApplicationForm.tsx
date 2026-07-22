'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { WorkExperience } from '@/types'

type EditableExperience = WorkExperience & { key: string }

function blankExperience(): EditableExperience {
  return {
    key: crypto.randomUUID(),
    jobTitle: '',
    employer: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
  }
}

export function JobApplicationForm({
  jobId,
  onSubmitted,
  onCancel,
}: {
  jobId: string
  onSubmitted: () => void
  onCancel: () => void
}) {
  const { user } = useCurrentUser()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [experiences, setExperiences] = useState<EditableExperience[]>([blankExperience()])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    setFirstName((value) => value || user.firstName || '')
    setLastName((value) => value || user.lastName || '')
  }, [user])

  function updateExperience(key: string, updates: Partial<EditableExperience>) {
    setExperiences((items) => items.map((item) => item.key === key ? { ...item, ...updates } : item))
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const form = new FormData(event.currentTarget)
      form.set('firstName', firstName)
      form.set('lastName', lastName)
      form.set('workExperience', JSON.stringify(experiences.map(({ key: _key, ...experience }) => experience)))

      const response = await fetch(`/api/jobs/${jobId}/apply`, { method: 'POST', body: form })
      const body = await response.json()
      if (!response.ok) {
        toast.error(body.error || 'Could not submit your application')
        return
      }
      toast.success('Application submitted successfully')
      onSubmitted()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submitApplication} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="application-first-name">First name *</label>
          <input id="application-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="input-field" required minLength={2} maxLength={80} autoComplete="given-name" />
        </div>
        <div>
          <label className="label" htmlFor="application-last-name">Last name *</label>
          <input id="application-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} className="input-field" required minLength={2} maxLength={80} autoComplete="family-name" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="application-cover-letter">Cover letter *</label>
        <textarea id="application-cover-letter" name="coverLetter" className="input-field min-h-40 resize-y" required minLength={100} maxLength={5000} placeholder="Explain why your skills and experience make you a strong fit for this role." />
        <p className="mt-1 text-xs text-slate-500">Minimum 100 characters.</p>
      </div>

      <div>
        <label className="label" htmlFor="application-cv">CV or résumé *</label>
        <input id="application-cv" name="cv" type="file" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-600" />
        <p className="mt-1 text-xs text-slate-500">PDF, DOC, or DOCX; maximum 5MB.</p>
      </div>

      <div>
        <label className="label" htmlFor="application-education">Education *</label>
        <textarea id="application-education" name="education" className="input-field min-h-28 resize-y" required minLength={10} maxLength={3000} placeholder="List your qualification, institution, field of study, and graduation year." />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Work experience *</h3>
            <p className="text-xs text-slate-500">Add your most relevant experience first.</p>
          </div>
          <button type="button" onClick={() => setExperiences((items) => [...items, blankExperience()])} disabled={experiences.length >= 10} className="btn-ghost px-3 py-2 text-xs">
            + Add experience
          </button>
        </div>

        <div className="space-y-4">
          {experiences.map((experience, index) => (
            <div key={experience.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Experience {index + 1}</h4>
                {experiences.length > 1 && (
                  <button type="button" onClick={() => setExperiences((items) => items.filter((item) => item.key !== experience.key))} className="text-xs font-medium text-red-500">Remove</button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={experience.jobTitle} onChange={(event) => updateExperience(experience.key, { jobTitle: event.target.value })} className="input-field" required placeholder="Job title" maxLength={160} />
                <input value={experience.employer} onChange={(event) => updateExperience(experience.key, { employer: event.target.value })} className="input-field" required placeholder="Employer" maxLength={180} />
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Start date</label>
                  <input type="month" value={experience.startDate} onChange={(event) => updateExperience(experience.key, { startDate: event.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">End date</label>
                  <input type="month" value={experience.endDate || ''} onChange={(event) => updateExperience(experience.key, { endDate: event.target.value })} className="input-field" disabled={experience.current} required={!experience.current} />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={experience.current} onChange={(event) => updateExperience(experience.key, { current: event.target.checked, endDate: event.target.checked ? '' : experience.endDate })} />
                I currently work here
              </label>
              <textarea value={experience.description || ''} onChange={(event) => updateExperience(experience.key, { description: event.target.value })} className="input-field mt-3 min-h-24 resize-y" maxLength={1500} placeholder="Key responsibilities and achievements (optional)" />
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-ghost px-6 py-3">Cancel</button>
        <button type="submit" disabled={submitting} className="btn-primary px-8 py-3">
          {submitting ? 'Submitting...' : 'Submit application'}
        </button>
      </div>
    </form>
  )
}
