'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { VerifiedBusinessBadge } from '@/components/ui'
import { BUSINESS_CATEGORY_GROUPS, NIGERIAN_STATE_NAMES } from '@/types'

interface BusinessData {
  businessName: string
  category: string
  businessContact: string
  description: string
  location: string
  state: string
  lga: string
  yearsOfExperience: number
  verified: number
}

export default function MyBusinessPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<BusinessData>({
    businessName: '',
    category: '',
    businessContact: '',
    description: '',
    location: '',
    state: '',
    lga: '',
    yearsOfExperience: 0,
    verified: 0,
  })

  useEffect(() => {
    if (userLoading) return
    if (!user || user.role !== 'artisan') {
      setFetching(false)
      return
    }
    fetch('/api/business')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setForm({
            businessName: res.data.businessName || '',
            category: res.data.category || '',
            businessContact: res.data.businessContact || '',
            description: res.data.description || '',
            location: res.data.location || '',
            state: res.data.state || '',
            lga: res.data.lga || '',
            yearsOfExperience: res.data.yearsOfExperience || 0,
            verified: res.data.verified || 0,
          })
        }
      })
      .catch(() => toast.error('Failed to load business data'))
      .finally(() => setFetching(false))
  }, [user, userLoading])

  function update<K extends keyof BusinessData>(key: K, value: BusinessData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          category: form.category,
          businessContact: form.businessContact,
          description: form.description,
          location: form.location,
          state: form.state,
          lga: form.lga,
          yearsOfExperience: form.yearsOfExperience,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Business saved')
      } else {
        toast.error('Couldn\u2019t save business')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (userLoading || fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!user || user.role !== 'artisan') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-500">Only artisans can manage a business profile.</p>
      </div>
    )
  }

  const requiredFields = [
    form.businessName,
    form.category,
    form.businessContact,
    form.description,
    form.location,
    form.state,
  ]
  const completedFields = requiredFields.filter((value) => String(value || '').trim().length > 0).length
  const completion = Math.round((completedFields / requiredFields.length) * 100)
  const nextStep = completion < 100
    ? 'Complete the missing details so clients can trust what they see.'
    : form.verified === 1
      ? 'Your profile is ready for clients.'
      : 'Submit verification to add the green badge.'

  return (
    <>
      <div className="mb-6 rounded-3xl border border-brand-100 bg-[#efffde] p-5 shadow-[0_10px_30px_rgba(15,79,74,0.05)] sm:mb-7 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">Business Profile</h1>
            <p className="mt-1 text-sm text-slate-600">The details clients use before they book you.</p>
          </div>
          {form.verified === 1 ? (
            <VerifiedBusinessBadge />
          ) : (
            <a href="/dashboard/verify-business" className="btn-ghost bg-white px-4 py-2.5 text-sm justify-center">
              Get verified
            </a>
          )}
        </div>
      </div>

      {form.verified === 1 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <VerifiedBusinessBadge />
          <span className="text-sm text-green-700">Your business is verified</span>
        </div>
      )}

      <div className="friendly-card mb-5 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Profile strength</p>
          <span className="text-sm font-bold text-brand-600">{completion}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${completion}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-500">{nextStep}</p>
      </div>

      <div className="card max-w-3xl">
        <div className="mb-5 border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-semibold text-slate-900">Public business details</h2>
          <p className="mt-1 text-sm text-slate-500">Keep this short, specific, and easy to verify.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group sm:col-span-2">
            <label className="label">Business Name *</label>
            <input
              className="input-field"
              value={form.businessName}
              onChange={(e) => update('businessName', e.target.value)}
              placeholder="e.g. Bright Spark Electrical"
            />
          </div>

          <div className="form-group">
            <label className="label">Category *</label>
            <select
              className="input-field appearance-none"
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
            >
              <option value="">Select category</option>
              {BUSINESS_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Business Phone</label>
            <input
              className="input-field"
              type="tel"
              inputMode="tel"
              value={form.businessContact}
              onChange={(e) => update('businessContact', e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>

          <div className="form-group">
            <label className="label">City / State *</label>
            <select
              className="input-field appearance-none"
              value={form.state}
              onChange={(e) => update('state', e.target.value)}
            >
              <option value="">Select state</option>
              {NIGERIAN_STATE_NAMES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">LGA</label>
            <input
              className="input-field"
              value={form.lga}
              onChange={(e) => update('lga', e.target.value)}
              placeholder="Local Government Area"
            />
          </div>

          <div className="form-group sm:col-span-2">
            <label className="label">Business Address</label>
            <input
              className="input-field"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="e.g. 15 Adeola Odeku Street, Victoria Island"
            />
          </div>

          <div className="form-group">
            <label className="label">Years of Experience</label>
            <input
              className="input-field"
              type="number"
              inputMode="numeric"
              min="0"
              value={form.yearsOfExperience}
              onChange={(e) => update('yearsOfExperience', parseInt(e.target.value) || 0)}
              placeholder="5"
            />
          </div>

          <div className="form-group sm:col-span-2">
            <label className="label">Full Business Description</label>
            <textarea
              className="input-field resize-y"
              rows={5}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Describe your business in detail – what services you offer, your experience, your team, etc."
            />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-5 mt-6 flex gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:px-6">
          <button
            onClick={handleSave}
            disabled={saving || !form.businessName || !form.category || !form.state}
            className="btn-primary px-8 py-2.5"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}
