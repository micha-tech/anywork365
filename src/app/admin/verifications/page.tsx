'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'

interface VerificationRow {
  id: number
  businessId: number
  businessName: string
  uid: string
  category: string
  state: string
  fullName: string
  email: string
  phoneNumber: string
  nin: string | null
  photo_url: string | null
  nin_card_url: string | null
  utility_bill_url: string | null
  business_registration_url: string | null
  trade_certificate_url: string | null
  status: string
  admin_notes: string | null
  submitted_at: string
  reviewed_at: string | null
}

interface VerificationDocument {
  key: keyof Pick<
    VerificationRow,
    'photo_url' | 'nin_card_url' | 'utility_bill_url' | 'business_registration_url' | 'trade_certificate_url'
  >
  label: string
  url: string
}

const DOCUMENT_FIELDS: Array<{ key: VerificationDocument['key']; label: string }> = [
  { key: 'photo_url', label: 'Passport Photo' },
  { key: 'nin_card_url', label: 'NIN Card' },
  { key: 'utility_bill_url', label: 'Utility Bill' },
  { key: 'business_registration_url', label: 'Business Registration' },
  { key: 'trade_certificate_url', label: 'Trade Certificate' },
]

export default function AdminVerificationsPage() {
  const [rows, setRows] = useState<VerificationRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [previewDoc, setPreviewDoc] = useState<VerificationDocument | null>(null)
  const limit = 20

  const loadData = useCallback(async () => {
    setLoading(true)
    let url = `/api/admin/verifications?page=${page}&limit=${limit}`
    if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`
    const res = await fetch(url)
    const d = await res.json()
    if (d.success) { setRows(d.data); setTotal(d.total) }
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  const review = async (id: number, action: string) => {
    const adminNotes = prompt(action === 'approve' ? 'Add notes (optional):' : 'Reason for rejection:') || ''
    if (action === 'reject' && !adminNotes) return
    const res = await fetch(`/api/admin/verifications/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, adminNotes }),
    })
    const d = await res.json()
    if (d.success) { toast.success('Verification updated'); loadData() }
    else toast.error(d.error || 'Action failed')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Business Verifications ({total})</h1>

      <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        className="border border-slate-300 rounded-xl px-3 py-2 text-sm">
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="">All</option>
      </select>

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-slate-500 text-center py-8">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-8">No verifications found</div>
        ) : rows.map((r) => {
          const documents = getVerificationDocuments(r)

          return (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">{r.businessName}</h3>
                <p className="text-xs text-slate-500">{r.fullName} &middot; {r.email}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                r.status === 'approved' ? 'bg-green-100 text-green-700' :
                r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>{r.status}</span>
            </div>

            <div className="text-xs text-slate-600 space-y-1 mb-3">
              <p>Category: {r.category} &middot; State: {r.state} &middot; Phone: {r.phoneNumber || '-'}</p>
              <p>Submitted: {new Date(r.submitted_at).toLocaleDateString()}</p>
              {r.admin_notes && <p className="text-slate-400 italic">Notes: {r.admin_notes}</p>}
            </div>

            <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted documents</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                  {documents.length} / {DOCUMENT_FIELDS.length}
                </span>
              </div>

              {documents.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {documents.map((doc) => (
                    <DocumentCard key={doc.key} doc={doc} onPreview={() => setPreviewDoc(doc)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  No documents were attached to this verification request.
                </div>
              )}
            </div>

            {r.nin && (
              <div className="mb-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
                NIN: <span className="font-medium text-slate-900">{r.nin}</span>
              </div>
            )}

            {r.status === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => review(r.id, 'approve')} className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 font-medium">Approve</button>
                <button onClick={() => review(r.id, 'reject')} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium">Reject</button>
              </div>
            )}
          </div>
        )})}
      </div>

      {Math.ceil(total / limit) > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40">Prev</button>
          <span className="text-slate-500 self-center">{page} / {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  )
}

function getVerificationDocuments(row: VerificationRow): VerificationDocument[] {
  return DOCUMENT_FIELDS.flatMap(({ key, label }) => {
    const url = row[key]
    return url ? [{ key, label, url }] : []
  })
}

function isPdfDocument(url: string): boolean {
  return url.toLowerCase().split('?')[0].endsWith('.pdf')
}

function DocumentCard({ doc, onPreview }: { doc: VerificationDocument; onPreview: () => void }) {
  const isPdf = isPdfDocument(doc.url)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onPreview}
        className="block aspect-[4/3] w-full bg-slate-100 text-left"
        aria-label={`Preview ${doc.label}`}
      >
        {isPdf ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h8M8 17h5" />
            </svg>
            <span className="text-xs font-medium">PDF document</span>
          </div>
        ) : (
          <img src={doc.url} alt={doc.label} className="h-full w-full object-cover" />
        )}
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
        <p className="truncate text-xs font-medium text-slate-700">{doc.label}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPreview} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            Preview
          </button>
          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-slate-500 hover:text-slate-700">
            Open
          </a>
        </div>
      </div>
    </div>
  )
}

function DocumentPreviewModal({ doc, onClose }: { doc: VerificationDocument; onClose: () => void }) {
  const isPdf = isPdfDocument(doc.url)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">{doc.label}</h2>
            <p className="text-xs text-slate-500">Verification document preview</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Open in new tab
            </a>
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100 p-3">
          {isPdf ? (
            <iframe title={doc.label} src={doc.url} className="h-[72vh] w-full rounded-lg border border-slate-200 bg-white" />
          ) : (
            <div className="flex h-[72vh] items-center justify-center">
              <img src={doc.url} alt={doc.label} className="max-h-full max-w-full rounded-lg object-contain shadow-sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
