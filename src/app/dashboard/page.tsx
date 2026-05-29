'use client'

import { useEffect, useState, useCallback, type ComponentType } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { SkeletonMetricCard } from '@/components/ui/Skeleton'

interface Metric {
  label: string
  value: string
  change: string
}

interface ActivityItem {
  initials: string
  color: string
  text: string
  sub: string
  time: string
}

interface QuickAction {
  href: string
  label: string
  sub: string
  icon: ComponentType<{ className?: string }>
}

export default function DashboardPage() {
  const { user, loading } = useCurrentUser()
  const isVendor = user?.role === 'vendor'
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: 'Active Jobs', value: '-', change: 'Loading...' },
    { label: 'Applications', value: '-', change: 'Loading...' },
    { label: 'Hired Pros', value: '-', change: 'Loading...' },
    { label: 'Jobs Completed', value: '-', change: 'Loading...' },
  ])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    if (loading || !user) return
    setDashboardLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      const json = await res.json()
      if (!json.success) return
      const { stats, activity: acts, changeMap } = json.data
      if (isVendor) {
        setMetrics([
          { label: 'Active Jobs', value: String(stats.activeJobs), change: changeMap.activeJobs },
          { label: 'Applications', value: String(stats.applications), change: changeMap.applications },
          { label: 'Hired Pros', value: String(stats.hiredPros), change: changeMap.hiredPros },
          { label: 'Jobs Completed', value: String(stats.jobsCompleted), change: changeMap.jobsCompleted },
        ])
      } else {
        const activeNow = Math.max(0, stats.activeJobs - stats.jobsCompleted)
        setMetrics([
          { label: 'Total Bookings', value: String(stats.activeJobs), change: `${stats.activeJobs} total` },
          { label: 'Active Now', value: String(activeNow), change: activeNow > 0 ? `${activeNow} in progress` : 'No active bookings' },
          { label: 'Vendors Hired', value: String(stats.hiredPros), change: changeMap.hiredPros },
          { label: 'Completed', value: String(stats.jobsCompleted), change: changeMap.jobsCompleted },
        ])
      }
      setActivity(acts)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setDashboardLoading(false)
    }
  }, [user, loading, isVendor])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const greeting = loading ? 'Good morning' : `Good morning, ${user?.firstName ?? 'there'}`
  const quickActions: QuickAction[] = user?.role === 'vendor'
    ? [
        { href: '/dashboard/post-job', icon: PostJobIcon, label: 'Post a Job', sub: 'Attract clients' },
        { href: '/dashboard/my-business', icon: StoreIcon, label: 'My Business', sub: 'Update your profile' },
        { href: '/dashboard/profile', icon: UserIcon, label: 'Edit Profile', sub: 'Update your info' },
      ]
    : [
        { href: '/professionals', icon: SearchIcon, label: 'Find Vendors', sub: 'Browse vendors nearby' },
        { href: '/jobs', icon: BriefcaseIcon, label: 'Browse Jobs', sub: 'Find work opportunities' },
        { href: '/dashboard/profile', icon: UserIcon, label: 'Edit Profile', sub: 'Update your info' },
      ]

  return (
    <PullToRefresh onRefresh={fetchDashboard}>
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{greeting}</h1>
            <p className="mt-1 text-sm text-slate-600">Here is what is happening with your projects.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-bold uppercase text-brand-600">
            Account overview
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-7">
        {dashboardLoading ? (
          <>
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
          </>
        ) : metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] sm:p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 leading-tight">{m.label}</p>
            <p className="font-display text-2xl sm:text-3xl font-bold text-slate-900 my-1">{m.value}</p>
            <p className="text-xs font-medium text-brand-600">{m.change}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-slate-900">Recent Activity</h2>
          <span className="text-xs font-medium text-slate-400">Live updates</span>
        </div>
        <div className="divide-y divide-slate-100">
          {dashboardLoading ? (
            <p className="text-sm text-slate-500 py-4 text-center">Loading activity...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No recent activity</p>
          ) : activity.map((a, i) => (
            <div key={i} className="flex items-start gap-3 py-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden ${a.color}`}>
                <span className="leading-none">{a.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 leading-snug">{a.text}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.sub}</p>
              </div>
              <p className="text-xs text-slate-500 whitespace-nowrap">{a.time}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {quickActions.map((a) => {
          const Icon = a.icon
          return (
            <Link key={a.href} href={a.href} className="card group text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-md">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                <Icon className="h-5 w-5" />
              </div>
              <p className="font-semibold text-sm text-slate-900">{a.label}</p>
              <p className="text-xs text-slate-500 mt-1">{a.sub}</p>
            </Link>
          )
        })}
      </div>
    </PullToRefresh>
  )
}

function PostJobIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h16l-1 10H5L4 10Z" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  )
}
