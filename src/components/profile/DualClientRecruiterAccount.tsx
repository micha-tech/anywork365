'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AuthUser } from '@/types'
import { COMPANY_SIZES, INDUSTRY_CATEGORIES, RECRUITMENT_FUNCTIONS } from '@/lib/registration-options'
import { notifyCurrentUserChanged } from '@/hooks/useCurrentUser'

interface RecruiterProfileForm {
  companyName: string
  companySize: string
  industryCategory: string
  recruitmentFunction: string
  position: string
  companyWebsite: string
}

const EMPTY_PROFILE: RecruiterProfileForm = {
  companyName: '',
  companySize: '',
  industryCategory: '',
  recruitmentFunction: '',
  position: '',
  companyWebsite: '',
}

export function DualClientRecruiterAccount({ user }: { user: AuthUser }) {
  const [profile, setProfile] = useState<RecruiterProfileForm>({
    ...EMPTY_PROFILE,
    companyName: `${user.firstName} ${user.lastName}`.trim(),
  })
  const [profileReady, setProfileReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [showRecruiterForm, setShowRecruiterForm] = useState(user.role === 'recruiter')

  useEffect(() => {
    if (!user.canSwitchClientRecruiter) return
    fetch('/api/profile/recruiter', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(body.error || 'Could not load recruiter profile')
        if (body.data) {
          setProfile(body.data)
          setProfileReady(true)
        }
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false))
  }, [user.canSwitchClientRecruiter])

  if (!user.canSwitchClientRecruiter) return null

  function updateField(field: keyof RecruiterProfileForm, value: string) {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  async function switchRole(targetRole: 'client' | 'recruiter', recruiterProfileExists = profileReady) {
    if (targetRole === user.role) return
    if (targetRole === 'recruiter' && !recruiterProfileExists) {
      setShowRecruiterForm(true)
      toast.info('Complete the recruiter profile before switching.')
      return
    }

    setSwitching(true)
    try {
      const response = await fetch('/api/account-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole }),
      })
      const body = await response.json()
      if (!response.ok || !body.success) {
        toast.error(body.error || 'Could not switch account type')
        return
      }
      notifyCurrentUserChanged()
      toast.success(`Switched to ${targetRole} profile`)
      window.location.href = targetRole === 'recruiter' ? '/dashboard/jobs' : '/artisans'
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSwitching(false)
    }
  }

  async function saveRecruiterProfile() {
    setSaving(true)
    try {
      const response = await fetch('/api/profile/recruiter', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      const body = await response.json()
      if (!response.ok || !body.success) {
        toast.error(body.error || 'Could not save recruiter profile')
        return
      }
      setProfile(body.data)
      setProfileReady(true)
      toast.success('Recruiter profile saved')
      if (user.role === 'client') {
        await switchRole('recruiter', true)
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="account-mode" className="card mb-5 scroll-mt-24 border-brand-100 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9f9_100%)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">Client and recruiter account</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Account exception</span>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Switch profiles without losing client bookings, wallet activity or recruiter information.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-brand-500 px-3 py-1.5 text-xs font-bold capitalize text-white">
          {user.role} profile active
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={switching || user.role === 'client'}
          onClick={() => switchRole('client')}
          className={`rounded-2xl border p-4 text-left transition-all disabled:cursor-default ${
            user.role === 'client'
              ? 'border-brand-500 bg-white shadow-[0_6px_18px_rgba(15,79,74,0.10)]'
              : 'border-slate-200 bg-white/70 hover:border-brand-300'
          }`}
        >
          <span className="text-sm font-bold text-slate-900">Client profile</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">Book artisans, manage bookings, messages and wallet activity.</span>
        </button>
        <button
          type="button"
          disabled={switching || user.role === 'recruiter'}
          onClick={() => switchRole('recruiter')}
          className={`rounded-2xl border p-4 text-left transition-all disabled:cursor-default ${
            user.role === 'recruiter'
              ? 'border-brand-500 bg-white shadow-[0_6px_18px_rgba(15,79,74,0.10)]'
              : 'border-slate-200 bg-white/70 hover:border-brand-300'
          }`}
        >
          <span className="text-sm font-bold text-slate-900">Recruiter profile</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">Post jobs, manage applications and review candidates.</span>
        </button>
      </div>

      {!loading && (showRecruiterForm || user.role === 'recruiter') && (
        <div className="mt-6 border-t border-brand-100 pt-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recruiter profile details</h3>
              <p className="mt-1 text-xs text-slate-500">These details remain separate from the client profile.</p>
            </div>
            {profileReady && user.role === 'client' && (
              <button type="button" onClick={() => setShowRecruiterForm(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
                Close
              </button>
            )}
          </div>

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Company name">
              <input className="input-field" value={profile.companyName} onChange={(event) => updateField('companyName', event.target.value)} maxLength={180} placeholder="Company name" />
            </Field>
            <Field label="Company size">
              <select className="input-field appearance-none" value={profile.companySize} onChange={(event) => updateField('companySize', event.target.value)}>
                <option value="">Select company size</option>
                {COMPANY_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Primary industry served">
              <select className="input-field appearance-none" value={profile.industryCategory} onChange={(event) => updateField('industryCategory', event.target.value)}>
                <option value="">Select industry</option>
                {INDUSTRY_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Recruitment function">
              <select className="input-field appearance-none" value={profile.recruitmentFunction} onChange={(event) => updateField('recruitmentFunction', event.target.value)}>
                <option value="">Select recruitment function</option>
                {RECRUITMENT_FUNCTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Your position">
              <input className="input-field" value={profile.position} onChange={(event) => updateField('position', event.target.value)} maxLength={160} placeholder="For example, HR Manager" />
            </Field>
            <Field label="Company website" optional>
              <input className="input-field" type="url" inputMode="url" value={profile.companyWebsite} onChange={(event) => updateField('companyWebsite', event.target.value)} placeholder="https://" />
            </Field>
          </div>

          <button type="button" onClick={saveRecruiterProfile} disabled={saving || switching} className="btn-primary w-full sm:w-auto">
            {saving ? 'Saving...' : user.role === 'client' ? 'Save and switch to recruiter' : 'Save recruiter details'}
          </button>
        </div>
      )}

      {loading && <div className="mt-5 h-20 animate-pulse rounded-2xl bg-white/70" />}
      {!loading && user.role === 'client' && profileReady && !showRecruiterForm && (
        <button type="button" onClick={() => setShowRecruiterForm(true)} className="mt-4 text-xs font-semibold text-brand-700 hover:text-brand-800">
          Edit recruiter profile details
        </button>
      )}
    </section>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
    </div>
  )
}
