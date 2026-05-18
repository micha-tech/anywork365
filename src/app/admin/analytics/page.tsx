'use client'

import { useEffect, useState } from 'react'

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

export default function AdminAnalyticsPage() {
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
  if (!stats) return <div className="text-sm text-red-500">Failed to load stats</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>

      <Section title="Users">
        <Bar label="Total" value={stats.users.total} max={stats.users.total} />
        <Bar label="Vendors" value={stats.users.vendors} max={stats.users.total} />
        <Bar label="Clients" value={stats.users.clients} max={stats.users.total} />
        <Bar label="Admins" value={stats.users.admins} max={stats.users.total} />
      </Section>

      <Section title="Bookings">
        <Bar label="Total" value={stats.bookings.total} max={stats.bookings.total} />
        <Bar label="Pending" value={stats.bookings.pending} max={stats.bookings.total} />
        <Bar label="Completed" value={stats.bookings.completed} max={stats.bookings.total} />
      </Section>

      <Section title="Jobs">
        <Bar label="Total" value={stats.jobs.total} max={stats.jobs.total} />
        <Bar label="Open" value={stats.jobs.open} max={stats.jobs.total} />
      </Section>

      <Section title="Financial">
        <Metric label="Total Revenue" value={formatNGN(stats.revenue.total)} />
        <Metric label="Withdrawn" value={formatNGN(stats.revenue.withdrawn)} />
        <Metric label="Active Escrows" value={formatNGN(stats.activeEscrows.total)} sub={`${stats.activeEscrows.count} escrows`} />
        <Metric label="Today's Transactions" value={String(stats.transactionsToday)} />
      </Section>

      <Section title="Operations">
        <Metric label="Pending Verifications" value={String(stats.pendingVerifications)} />
        <Metric label="Open Disputes" value={String(stats.openDisputes)} />
        <Metric label="New Users Today" value={String(stats.usersToday)} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-700 w-16 text-right">{value.toLocaleString()}</span>
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-slate-900">{value}</span>
        {sub && <span className="text-xs text-slate-400 ml-2">{sub}</span>}
      </div>
    </div>
  )
}
