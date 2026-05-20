'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  users: { total: number; vendors: number; clients: number; admins: number }
  bookings: { total: number; pending: number; completed: number }
  jobs: { total: number; open: number }
  revenue: { total: number; withdrawn: number }
  pendingVerifications: number
  openDisputes: number
  transactionsToday: number
  usersToday: number
  activeEscrows: { count: number; total: number }
}

function formatNGN(n: number): string {
  return '₦' + Number(n).toLocaleString('en-US')
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-slate-500">Loading...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Admin Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total Users" value={stats?.users.total ?? 0} sub={`${stats?.users.vendors ?? 0} vendors`} />
        <StatCard label="Today's Users" value={stats?.usersToday ?? 0} sub="new signups" />
        <StatCard label="Total Bookings" value={stats?.bookings.total ?? 0} sub={`${stats?.bookings.pending ?? 0} pending`} />
        <StatCard label="Open Jobs" value={stats?.jobs.open ?? 0} sub={`${stats?.jobs.total ?? 0} total`} />
        <StatCard label="Revenue" value={formatNGN(stats?.revenue.total ?? 0)} sub={`${formatNGN(stats?.revenue.withdrawn ?? 0)} withdrawn`} />
        <StatCard label="Active Escrows" value={formatNGN(stats?.activeEscrows.total ?? 0)} sub={`${stats?.activeEscrows.count ?? 0} escrows`} />
        <StatCard label="Today's Transactions" value={stats?.transactionsToday ?? 0} sub="wallet transactions" />
        <StatCard label="Open Disputes" value={stats?.openDisputes ?? 0} sub="needs attention" variant={stats?.openDisputes ? 'warning' : 'default'} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/verifications" className="text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-brand-300 transition-colors">
          Pending Verifications: <span className="font-semibold text-brand-500">{stats?.pendingVerifications ?? 0}</span>
        </Link>
        <Link href="/admin/reconciliation" className="text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-brand-300 transition-colors">
          View All Transactions
        </Link>
        <Link href="/admin/users" className="text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-brand-300 transition-colors">
          Manage Users
        </Link>
        <Link href="/admin/disputes" className="text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-brand-300 transition-colors">
          Disputes: <span className="font-semibold text-brand-500">{stats?.openDisputes ?? 0}</span>
        </Link>
        <Link href="/admin/analytics" className="text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-brand-300 transition-colors">
          Analytics
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, variant = 'default' }: { label: string; value: string | number; sub: string; variant?: 'default' | 'warning' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${variant === 'warning' ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
