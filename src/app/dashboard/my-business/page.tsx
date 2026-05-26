'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { NIGERIAN_STATE_NAMES, JOB_CATEGORIES } from '@/types'

interface BusinessData {
  businessName: string
  category: string
  businessContact: string
  description: string
  location: string
  state: string
  lga: string
  yearsOfExperience: number
  feePerHour: number
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
    feePerHour: 0,
    verified: 0,
  })

  useEffect(() => {
    if (userLoading) return
    if (!user || user.role !== 'vendor') {
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
            feePerHour: res.data.feePerHour || 0,
            verified: res.data.verified || 0,
          })
        }
      })
      .catch(() => {})
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
          feePerHour: form.feePerHour,
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

  if (!user || user.role !== 'vendor') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-500">Only vendors can manage a business profile.</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-5 sm:mb-7">
        <h1 className="font-display text-xl sm:text-2xl font-semibold">My Business</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your business profile and attract clients</p>
      </div>

      {form.verified === 1 && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
          </svg>
          Your business is verified
        </div>
      )}

      <div className="card max-w-2xl">
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
              {JOB_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
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

          <div className="form-group">
            <label className="label">Fee per Hour (₦)</label>
            <input
              className="input-field"
              type="number"
              inputMode="numeric"
              min="0"
              value={form.feePerHour}
              onChange={(e) => update('feePerHour', parseInt(e.target.value) || 0)}
              placeholder="5000"
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

        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
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
