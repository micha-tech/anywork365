'use client'

import { useEffect, useState, useCallback } from 'react'

type Tab = 'transactions' | 'escrows' | 'withdrawals'

export default function AdminReconciliationPage() {
  const [tab, setTab] = useState<Tab>('transactions')

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Reconciliation</h1>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit text-sm">
        {(['transactions', 'escrows', 'withdrawals'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${tab === t ? 'bg-white text-slate-900 font-medium shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'escrows' && <EscrowsTab />}
      {tab === 'withdrawals' && <WithdrawalsTab />}
    </div>
  )
}

function TransactionsTab() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 20

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/transactions?page=${page}&limit=${limit}`)
    const d = await res.json()
    if (d.success) { setRows(d.data); setTotal(d.total) }
    setLoading(false)
  }, [page])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <div className="p-3 border-b border-slate-100 text-sm text-slate-500">{total} transactions</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
            <th className="p-3 font-medium">Ref</th>
            <th className="p-3 font-medium">User</th>
            <th className="p-3 font-medium">Type</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan={5} className="p-6 text-center text-slate-400">Loading...</td></tr> :
            rows.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-400">No transactions</td></tr> :
            rows.map((r: any, i: number) => (
              <tr key={r.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 text-xs font-mono text-slate-600">{r.reference || '-'}</td>
                <td className="p-3 text-slate-900">{r.fullName || r.email || '-'}</td>
                <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">{r.type}</span></td>
                <td className="p-3"><span className={`text-xs font-medium ${r.status === 'success' ? 'text-green-600' : r.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>{r.status}</span></td>
                <td className="p-3 text-xs text-slate-400">{r.created_at ? new Date(r.created_at as string).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {Math.ceil(total / limit) > 1 && (
        <div className="flex justify-center gap-2 p-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40">Prev</button>
          <span className="text-slate-500 self-center">{page} / {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

function EscrowsTab() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 20

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/escrows?page=${page}&limit=${limit}`)
    const d = await res.json()
    if (d.success) { setRows(d.data); setTotal(d.total) }
    setLoading(false)
  }, [page])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <div className="p-3 border-b border-slate-100 text-sm text-slate-500">{total} escrows</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
            <th className="p-3 font-medium">Booking</th>
            <th className="p-3 font-medium">Amount</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan={4} className="p-6 text-center text-slate-400">Loading...</td></tr> :
            rows.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-slate-400">No escrows</td></tr> :
            rows.map((r: any, i: number) => (
              <tr key={r.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 text-slate-900">{r.bookingTitle || `#${r.booking_id}`}</td>
                <td className="p-3 text-slate-600">₦{Number(r.amount).toLocaleString()}</td>
                <td className="p-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === 'held' ? 'bg-yellow-100 text-yellow-700' : r.status === 'released' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{r.status}</span></td>
                <td className="p-3 text-xs text-slate-400">{r.created_at ? new Date(r.created_at as string).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {Math.ceil(total / limit) > 1 && (
        <div className="flex justify-center gap-2 p-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40">Prev</button>
          <span className="text-slate-500 self-center">{page} / {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

function WithdrawalsTab() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 20

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/withdrawals?page=${page}&limit=${limit}`)
    const d = await res.json()
    if (d.success) { setRows(d.data); setTotal(d.total) }
    setLoading(false)
  }, [page])

  useEffect(() => { loadData() }, [loadData])

  const markPaid = async (id: string) => {
    const res = await fetch(`/api/admin/withdrawals/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid' }),
    })
    const d = await res.json()
    if (d.success) loadData()
  }

  const markFailed = async (id: string) => {
    const reason = prompt('Reason for failure:')
    if (!reason) return
    const res = await fetch(`/api/admin/withdrawals/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_failed', reason }),
    })
    const d = await res.json()
    if (d.success) loadData()
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <div className="p-3 border-b border-slate-100 text-sm text-slate-500">{total} withdrawals</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
            <th className="p-3 font-medium">User</th>
            <th className="p-3 font-medium">Amount</th>
            <th className="p-3 font-medium">Bank</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium">Date</th>
            <th className="p-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan={6} className="p-6 text-center text-slate-400">Loading...</td></tr> :
            rows.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-slate-400">No withdrawals</td></tr> :
            rows.map((r: any, i: number) => (
              <tr key={r.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 text-slate-900">{r.fullName || r.userId}</td>
                <td className="p-3 text-slate-600">₦{Number(r.amount).toLocaleString()}</td>
                <td className="p-3 text-xs text-slate-500">{r.bankName || '-'}</td>
                <td className="p-3"><span className={`text-xs font-medium ${r.status === 'paid' ? 'text-green-600' : r.status === 'pending' ? 'text-yellow-600' : 'text-red-600'}`}>{r.status}</span></td>
                <td className="p-3 text-xs text-slate-400">{r.createdAt ? new Date(r.createdAt as string).toLocaleDateString() : '-'}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {r.status === 'pending' && (
                      <>
                        <button onClick={() => markPaid(r.id)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100">Paid</button>
                        <button onClick={() => markFailed(r.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Fail</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {Math.ceil(total / limit) > 1 && (
        <div className="flex justify-center gap-2 p-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40">Prev</button>
          <span className="text-slate-500 self-center">{page} / {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}
