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

export default function AdminVerificationsPage() {
  const [rows, setRows] = useState<VerificationRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
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
        ) : rows.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
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

            {(r.photo_url || r.nin_card_url || r.utility_bill_url || r.business_registration_url || r.trade_certificate_url) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {r.photo_url && <DocLink url={r.photo_url} label="Photo" />}
                {r.nin_card_url && <DocLink url={r.nin_card_url} label="NIN Card" />}
                {r.utility_bill_url && <DocLink url={r.utility_bill_url} label="Utility Bill" />}
                {r.business_registration_url && <DocLink url={r.business_registration_url} label="Registration" />}
                {r.trade_certificate_url && <DocLink url={r.trade_certificate_url} label="Certificate" />}
              </div>
            )}

            {r.status === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => review(r.id, 'approve')} className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 font-medium">Approve</button>
                <button onClick={() => review(r.id, 'reject')} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium">Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {Math.ceil(total / limit) > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40">Prev</button>
          <span className="text-slate-500 self-center">{page} / {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

function DocLink({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
      {label}
    </a>
  )
}
