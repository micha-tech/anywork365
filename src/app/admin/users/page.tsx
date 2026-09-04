'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'

interface UserRow {
  uid: string
  email: string
  fullName: string
  role: 'client' | 'artisan' | 'professional' | 'recruiter' | 'intern' | 'support' | 'admin' | null
  hasBusinessAccount: number
  verified: number
  suspended: number
  dateJoined: string
  walletBalance: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const limit = 20

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set('search', search)
    if (roleFilter) params.set('role', roleFilter)

    const res = await fetch(`/api/admin/users?${params}`)
    const d = await res.json()
    if (d.success) {
      setUsers(d.data)
      setTotal(d.total)
    }
    setLoading(false)
  }, [page, search, roleFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleAction = async (uid: string, action: string, role?: string) => {
    if (action === 'delete') {
      const ok = window.confirm('Permanently delete this user from Firebase and the database? This cannot be undone.')
      if (!ok) return
    }
    const body: Record<string, string> = { uid, action }
    if (role) body.role = role
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    if (d.success) {
      toast.success(action === 'delete' ? 'User permanently deleted' : 'User updated')
      fetchUsers()
    }
    else toast.error(d.error || 'Action failed')
  }

  const totalPages = Math.ceil(total / limit)

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)

      const response = await fetch(`/api/admin/users/export?${params}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'Could not export users')
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') || ''
      const filename = disposition.match(/filename="?([^"]+)"?/i)?.[1]
        || `anywork365-users-${new Date().toISOString().slice(0, 10)}.csv`
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
      toast.success(`Exported ${total.toLocaleString()} user${total === 1 ? '' : 's'}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not export users')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users ({total})</h1>
          <p className="mt-1 text-xs text-slate-500">Export includes all users matching the current filters.</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || loading || total === 0}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? 'Preparing CSV...' : 'Export users CSV'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search name, email, or UID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 min-w-[200px] border border-slate-300 rounded-xl px-3 py-2 text-sm"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          <option value="client">Clients</option>
          <option value="artisan">Artisans</option>
          <option value="professional">Professionals</option>
          <option value="recruiter">Recruiters</option>
          <option value="support">Customer support</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Wallet</th>
              <th className="p-3 font-medium">Joined</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-slate-400">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-slate-400">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.uid} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-900">{u.fullName}</td>
                <td className="p-3 text-slate-600">{u.email}</td>
                <td className="p-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                    u.role === 'support' ? 'bg-teal-100 text-teal-700' :
                    u.role === 'artisan' ? 'bg-blue-100 text-blue-700' :
                    u.role === 'professional' ? 'bg-emerald-100 text-emerald-700' :
                    u.role === 'recruiter' ? 'bg-amber-100 text-amber-700' :
                    u.role === 'intern' ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {u.role || (u.hasBusinessAccount ? 'artisan' : 'client')}
                  </span>
                </td>
                <td className="p-3">
                  {u.suspended ? (
                    <span className="text-xs text-red-600 font-medium">Suspended</span>
                  ) : u.verified ? (
                    <span className="text-xs text-green-600 font-medium">Verified</span>
                  ) : (
                    <span className="text-xs text-slate-400">Active</span>
                  )}
                </td>
                <td className="p-3 text-slate-600">₦{Number(u.walletBalance).toLocaleString()}</td>
                <td className="p-3 text-xs text-slate-400">{new Date(u.dateJoined).toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    {u.suspended ? (
                      <button onClick={() => handleAction(u.uid, 'unsuspend')} className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-600 hover:bg-green-100">Unsuspend</button>
                    ) : (
                      <button onClick={() => handleAction(u.uid, 'suspend')} className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">Suspend</button>
                    )}
                    <button onClick={() => handleAction(u.uid, 'delete')} className="text-xs px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
            Prev
          </button>
          <span className="text-slate-500">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
            Next
          </button>
        </div>
      )}
    </div>
  )
}
