'use client'

import { useEffect, useState, useCallback } from 'react'

interface DisputeRow {
  id: number
  bookingId: number
  clientUid: string
  vendorUid: string
  raisedBy: string
  reason: string
  status: string
  resolution: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
  clientName: string | null
  vendorName: string | null
  raisedByName: string | null
}

export default function AdminDisputesPage() {
  const [rows, setRows] = useState<DisputeRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const limit = 20

  const loadData = useCallback(async () => {
    setLoading(true)
    let url = `/api/admin/disputes?page=${page}&limit=${limit}`
    if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`
    const res = await fetch(url)
    const d = await res.json()
    if (d.success) { setRows(d.data); setTotal(d.total) }
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  const resolve = async (id: number, status: string) => {
    const resolution = prompt('Resolution notes:')
    if (!resolution) return
    const res = await fetch(`/api/admin/disputes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution }),
    })
    const d = await res.json()
    if (d.success) loadData()
  }

  const investigate = async (id: number) => {
    const res = await fetch(`/api/admin/disputes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'investigating' }),
    })
    const d = await res.json()
    if (d.success) loadData()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Disputes ({total})</h1>

      <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        className="border border-slate-300 rounded-xl px-3 py-2 text-sm">
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="investigating">Investigating</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
      </select>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
              <th className="p-3 font-medium">#</th>
              <th className="p-3 font-medium">Client</th>
              <th className="p-3 font-medium">Vendor</th>
              <th className="p-3 font-medium">Reason</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="p-6 text-center text-slate-400">Loading...</td></tr> :
              rows.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-slate-400">No disputes</td></tr> :
              rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 text-xs text-slate-500">{r.id}</td>
                  <td className="p-3 text-slate-900">{r.clientName || r.clientUid}</td>
                  <td className="p-3 text-slate-900">{r.vendorName || r.vendorUid}</td>
                  <td className="p-3 text-xs text-slate-600 max-w-[200px] truncate">{r.reason}</td>
                  <td className="p-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.status === 'open' ? 'bg-red-100 text-red-700' :
                      r.status === 'investigating' ? 'bg-yellow-100 text-yellow-700' :
                      r.status === 'resolved' ? 'bg-green-100 text-green-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{r.status}</span>
                  </td>
                  <td className="p-3 text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      {r.status === 'open' && (
                        <button onClick={() => investigate(r.id)} className="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-600 hover:bg-yellow-100">Investigate</button>
                      )}
                      {(r.status === 'open' || r.status === 'investigating') && (
                        <>
                          <button onClick={() => resolve(r.id, 'resolved')} className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100">Resolve</button>
                          <button onClick={() => resolve(r.id, 'dismissed')} className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100">Dismiss</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
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
