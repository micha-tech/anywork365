'use client'

import { useEffect, useState, useCallback } from 'react'
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

export default function DashboardPage() {
  const { user, loading } = useCurrentUser()
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: 'Active Jobs',    value: '—', change: 'Loading...' },
    { label: 'Applications',   value: '—', change: 'Loading...' },
    { label: 'Hired Pros',     value: '—', change: 'Loading...' },
    { label: 'Jobs Completed', value: '—', change: 'Loading...' },
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
      setMetrics([
        { label: 'Active Jobs',    value: String(stats.activeJobs),    change: changeMap.activeJobs },
        { label: 'Applications',   value: String(stats.applications),   change: changeMap.applications },
        { label: 'Hired Pros',     value: String(stats.hiredPros),     change: changeMap.hiredPros },
        { label: 'Jobs Completed', value: String(stats.jobsCompleted), change: changeMap.jobsCompleted },
      ])
      setActivity(acts)
    } catch {
      // ignore
    } finally {
      setDashboardLoading(false)
    }
  }, [user, loading])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const greeting = loading
    ? 'Good morning 👋'
    : `Good morning, ${user?.firstName ?? 'there'} 👋`

  return (
    <PullToRefresh onRefresh={fetchDashboard}>
      <div className="mb-5 sm:mb-7">
        <h1 className="font-display text-xl sm:text-2xl font-semibold">{greeting}</h1>
        <p className="text-sm text-slate-500 mt-1">Here&apos;s what&apos;s happening with your projects</p>
      </div>

      {/* Metrics — 2 cols on all sizes */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-7">
        {dashboardLoading ? (
          <>
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
          </>
        ) : metrics.map((m) => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide leading-tight">{m.label}</p>
            <p className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 my-1">{m.value}</p>
            <p className="text-xs text-brand-600">{m.change}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity — full width */}
      <div className="card">
        <h2 className="font-medium text-base mb-4">Recent Activity</h2>
        <div className="divide-y divide-slate-200">
          {dashboardLoading ? (
            <p className="text-sm text-slate-500 py-4 text-center">Loading activity...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No recent activity</p>
          ) : activity.map((a, i) => (
            <div key={i} className="flex items-start gap-3 py-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden ${a.color}`}>
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

      {/* Quick actions */}
      <div className="mt-4 sm:mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { href: '/dashboard/post-job', emoji: '📋', label: 'Post a Job',    sub: 'Attract vendors' },
          { href: '/professionals',      emoji: '🔍', label: 'Find Vendors',  sub: 'Browse vendors nearby' },
          { href: '/dashboard/profile',  emoji: '✏️', label: 'Edit Profile',  sub: 'Update your info' },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="card hover:border-brand-500 transition-colors text-center py-5 sm:py-8">
            <div className="text-xl sm:text-2xl mb-2">{a.emoji}</div>
            <p className="font-medium text-xs sm:text-sm">{a.label}</p>
            <p className="text-xs text-slate-500 mt-1 hidden sm:block">{a.sub}</p>
          </Link>
        ))}
      </div>
    </PullToRefresh>
  )
}
