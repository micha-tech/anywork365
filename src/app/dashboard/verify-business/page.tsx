'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type DocField = 'photo' | 'nin_card' | 'utility_bill' | 'business_registration' | 'trade_certificate'

const DOC_LABELS: Record<DocField, string> = {
  photo: 'Passport Photograph',
  nin_card: 'NIN Card',
  utility_bill: 'Utility Bill',
  business_registration: 'Business Registration Document',
  trade_certificate: 'Trade Certificate',
}

const DOC_ACCEPTS = 'image/jpeg,image/jpg,image/png,image/webp,application/pdf'

async function uploadDoc(field: DocField, file: File): Promise<string | null> {
  const form = new FormData()
  form.append('field', field)
  form.append('file', file)
  const res = await fetch('/api/upload/verify-doc', { method: 'POST', body: form })
  const data = await res.json()
  return data.success ? data.data.url : null
}

export default function VerifyBusinessPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const [nin, setNin] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [verification, setVerification] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [urls, setUrls] = useState<Record<DocField, string | null>>({
    photo: null, nin_card: null, utility_bill: null,
    business_registration: null, trade_certificate: null,
  })
  const [uploading, setUploading] = useState<Record<DocField, boolean>>({
    photo: false, nin_card: false, utility_bill: false,
    business_registration: false, trade_certificate: false,
  })

  useEffect(() => {
    if (userLoading) return
    if (user?.role !== 'vendor') return

    fetch('/api/business/verify')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setIsVerified(d.data.isVerified)
          setVerification(d.data.verification)
          if (d.data.verification) {
            setNin(d.data.verification.nin || '')
          }
        }
      })
      .catch(() => console.error('Failed to load verification status'))
      .finally(() => setLoading(false))
  }, [user, userLoading])

  async function handleFileSelect(field: DocField, file: File) {
    setUploading(prev => ({ ...prev, [field]: true }))
    setMessage(null)
    const url = await uploadDoc(field, file)
    if (url) {
      setUrls(prev => ({ ...prev, [field]: url }))
    } else {
      setMessage({ type: 'error', text: `Failed to upload ${DOC_LABELS[field]}` })
    }
    setUploading(prev => ({ ...prev, [field]: false }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (nin.length !== 11) {
      setMessage({ type: 'error', text: 'NIN must be exactly 11 digits' })
      return
    }
    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nin, ...urls }),
      })
      const data = await res.json()
      if (data.success) {
        setVerification(data.data)
        setMessage({ type: 'success', text: data.message || 'Verification submitted!' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Submission failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  const pendingVerification = verification?.status === 'pending'

  return (
    <>
      <div className="mb-5 sm:mb-7">
        <h1 className="font-display text-xl sm:text-2xl font-semibold">Business Verification</h1>
        <p className="text-sm text-slate-500 mt-1">Verify your business to build trust with clients</p>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl mb-5 text-sm border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {message.text}
        </div>
      )}

      {isVerified ? (
        <div className="card text-center py-10">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-semibold text-slate-900 mb-1">Business Verified</h2>
          <p className="text-sm text-slate-500">Your business has been verified. Clients can see the verified badge on your profile.</p>
        </div>
      ) : pendingVerification ? (
        <div className="card text-center py-10">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-semibold text-slate-900 mb-1">Verification Pending</h2>
          <p className="text-sm text-slate-500 mb-4">Your documents are being reviewed. This usually takes 1-2 business days.</p>
          <p className="text-xs text-slate-400">Submitted: {verification?.submitted_at ? new Date(verification.submitted_at).toLocaleDateString() : ''}</p>
        </div>
      ) : (
        <div className="card max-w-2xl">
          <h2 className="font-medium text-base mb-1">Submit Your Documents</h2>
          <p className="text-sm text-slate-500 mb-6">All fields are required for verification</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="label">National Identity Number (NIN)</label>
              <input
                type="text"
                inputMode="numeric"
                value={nin}
                onChange={e => setNin(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="input-field"
                placeholder="12345678901"
                maxLength={11}
                required
              />
              <p className="text-xs text-slate-500 mt-1.5">Enter your 11-digit NIN</p>
            </div>

            {(['photo', 'nin_card', 'utility_bill', 'business_registration', 'trade_certificate'] as DocField[]).map((field) => (
              <div key={field} className="form-group">
                <label className="label">{DOC_LABELS[field]}</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-4 text-center hover:border-brand-400 transition-colors">
                  {urls[field] ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-green-600 truncate">Uploaded</span>
                      <button
                        type="button"
                        onClick={() => setUrls(prev => ({ ...prev, [field]: null }))}
                        className="text-xs text-red-500 hover:text-red-600 flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <svg className="w-6 h-6 text-slate-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-slate-500">
                        {uploading[field] ? 'Uploading...' : (
                          <><span className="text-brand-600 font-medium">Click to upload</span> or drag</>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">JPEG, PNG, WebP, PDF (max 10MB)</p>
                      <input
                        type="file"
                        accept={DOC_ACCEPTS}
                        className="hidden"
                        disabled={uploading[field]}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handleFileSelect(field, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 justify-center"
            >
              {submitting ? 'Submitting...' : 'Verify'}
            </button>
          </form>
        </div>
      )}
    </>
  )
}
