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
  icon: ComponentType<{ className?: string }>
  tone: 'brand' | 'amber' | 'green' | 'slate'
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

interface ClientSummary {
  totalBookings: number
  activeBookings: number
  completedBookings: number
  vendorsHired: number
}

interface VendorSummary {
  postedJobs: number
  bookingRequests: number
  confirmedBookings: number
  completedJobs: number
}

const metricToneStyles: Record<Metric['tone'], { icon: string; value: string; change: string }> = {
  brand: { icon: 'bg-brand-50 text-brand-500', value: 'text-slate-900', change: 'text-brand-600' },
  amber: { icon: 'bg-amber-50 text-amber-600', value: 'text-amber-700', change: 'text-amber-700' },
  green: { icon: 'bg-green-50 text-green-600', value: 'text-green-700', change: 'text-green-700' },
  slate: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900', change: 'text-slate-500' },
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const { user, loading } = useCurrentUser()
  const isVendor = user?.role === 'vendor'
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: 'Active Jobs', value: '-', change: 'Loading...', icon: BriefcaseIcon, tone: 'brand' },
    { label: 'Applications', value: '-', change: 'Loading...', icon: BookingsIcon, tone: 'amber' },
    { label: 'Hired Pros', value: '-', change: 'Loading...', icon: UserIcon, tone: 'slate' },
    { label: 'Jobs Completed', value: '-', change: 'Loading...', icon: CheckCircleIcon, tone: 'green' },
  ])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [clientSummary, setClientSummary] = useState<ClientSummary | null>(null)
  const [vendorSummary, setVendorSummary] = useState<VendorSummary | null>(null)
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
        setClientSummary(null)
        setVendorSummary({
          postedJobs: stats.activeJobs,
          bookingRequests: stats.applications,
          confirmedBookings: stats.hiredPros,
          completedJobs: stats.jobsCompleted,
        })
        setMetrics([
          { label: 'Booking Requests', value: String(stats.applications), change: stats.applications > 0 ? `${stats.applications} total requests` : 'No client requests yet', icon: BookingsIcon, tone: 'brand' },
          { label: 'Confirmed', value: String(stats.hiredPros), change: stats.hiredPros > 0 ? `${stats.hiredPros} active jobs` : 'No confirmed bookings', icon: ClockIcon, tone: 'amber' },
          { label: 'Completed', value: String(stats.jobsCompleted), change: stats.jobsCompleted > 0 ? `${stats.jobsCompleted} jobs closed` : 'No completed jobs yet', icon: CheckCircleIcon, tone: 'green' },
          { label: 'Posted Jobs', value: String(stats.activeJobs), change: changeMap.activeJobs, icon: BriefcaseIcon, tone: 'slate' },
        ])
      } else {
        setVendorSummary(null)
        const activeNow = Math.max(0, stats.activeJobs - stats.jobsCompleted)
        setClientSummary({
          totalBookings: stats.activeJobs,
          activeBookings: activeNow,
          completedBookings: stats.jobsCompleted,
          vendorsHired: stats.hiredPros,
        })
        setMetrics([
          { label: 'Bookings', value: String(stats.activeJobs), change: stats.activeJobs > 0 ? `${stats.activeJobs} total requests` : 'Start your first booking', icon: BookingsIcon, tone: 'brand' },
          { label: 'Active Now', value: String(activeNow), change: activeNow > 0 ? `${activeNow} in progress` : 'No active bookings', icon: ClockIcon, tone: 'amber' },
          { label: 'Vendors Hired', value: String(stats.hiredPros), change: stats.hiredPros > 0 ? `${stats.hiredPros} confirmed` : 'No confirmed vendors yet', icon: UserIcon, tone: 'slate' },
          { label: 'Completed', value: String(stats.jobsCompleted), change: stats.jobsCompleted > 0 ? `${stats.jobsCompleted} finished` : 'No completed jobs yet', icon: CheckCircleIcon, tone: 'green' },
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

  const greetingBase = getTimeOfDayGreeting()
  const greeting = loading ? greetingBase : `${greetingBase}, ${user?.firstName ?? 'there'}`
  const isClientDashboard = !loading && user?.role !== 'vendor'
  const isVendorDashboard = !loading && user?.role === 'vendor'
  const quickActions: QuickAction[] = user?.role === 'vendor'
    ? [
        { href: '/dashboard/bookings', icon: BookingsIcon, label: 'Bookings', sub: 'Review client requests' },
        { href: '/messages', icon: ChatIcon, label: 'Messages', sub: 'Reply to clients' },
        { href: '/dashboard/my-business', icon: StoreIcon, label: 'Business Profile', sub: 'Update services' },
        { href: '/dashboard/wallet', icon: WalletIcon, label: 'Wallet', sub: 'Earnings and payouts' },
      ]
    : [
        { href: '/professionals', icon: SearchIcon, label: 'Find Vendors', sub: 'Browse vendors nearby' },
        { href: '/dashboard/bookings', icon: BookingsIcon, label: 'My Bookings', sub: 'Track requests' },
        { href: '/messages', icon: ChatIcon, label: 'Messages', sub: 'Chat with vendors' },
        { href: '/dashboard/wallet', icon: WalletIcon, label: 'Wallet', sub: 'Payments and escrow' },
      ]

  return (
    <PullToRefresh onRefresh={fetchDashboard}>
      <div className={`mb-5 rounded-lg border p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:p-6 ${
        isClientDashboard || isVendorDashboard
          ? 'border-brand-100 bg-[linear-gradient(135deg,#ffffff_0%,#f2fbf8_100%)]'
          : 'border-slate-200 bg-white'
      }`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{greeting}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {isClientDashboard
                ? 'Book trusted vendors, track requests, and keep payments organized.'
                : isVendorDashboard
                  ? 'Manage requests, keep your business profile sharp, and track earnings.'
                  : 'Here is what is happening with your projects.'}
            </p>
          </div>
          {isClientDashboard ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/professionals" className="btn-primary px-4 py-2.5 text-sm justify-center">
                Find a vendor
              </Link>
              <Link href="/dashboard/bookings" className="btn-ghost px-4 py-2.5 text-sm justify-center bg-white">
                View bookings
              </Link>
            </div>
          ) : isVendorDashboard ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/dashboard/bookings" className="btn-primary px-4 py-2.5 text-sm justify-center">
                View requests
              </Link>
              <Link href="/dashboard/my-business" className="btn-ghost px-4 py-2.5 text-sm justify-center bg-white">
                Update business
              </Link>
            </div>
          ) : (
            <span className="inline-flex w-fit items-center rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-bold uppercase text-brand-600">
              Account overview
            </span>
          )}
        </div>
      </div>

      {isClientDashboard && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${
                clientSummary?.activeBookings ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-500'
              }`}>
                {clientSummary?.activeBookings ? <ClockIcon className="h-5 w-5" /> : <SearchIcon className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {dashboardLoading
                    ? 'Checking your bookings...'
                    : clientSummary?.activeBookings
                      ? `${clientSummary.activeBookings} booking${clientSummary.activeBookings === 1 ? '' : 's'} need attention`
                      : 'Ready to get something done?'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {clientSummary?.activeBookings
                    ? 'Review active requests, confirm progress, or message your vendor.'
                    : 'Browse verified vendors and send your first service request.'}
                </p>
              </div>
            </div>
            <Link
              href={clientSummary?.activeBookings ? '/dashboard/bookings' : '/professionals'}
              className="btn-primary px-4 py-2.5 text-sm justify-center"
            >
              {clientSummary?.activeBookings ? 'Open bookings' : 'Browse vendors'}
            </Link>
          </div>
        </div>
      )}

      {isVendorDashboard && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${
                vendorSummary?.bookingRequests ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-500'
              }`}>
                {vendorSummary?.bookingRequests ? <BookingsIcon className="h-5 w-5" /> : <StoreIcon className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {dashboardLoading
                    ? 'Checking your requests...'
                    : vendorSummary?.bookingRequests
                      ? `${vendorSummary.bookingRequests} booking request${vendorSummary.bookingRequests === 1 ? '' : 's'} on record`
                      : 'Make your profile easier to choose'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {vendorSummary?.bookingRequests
                    ? 'Review client requests, confirm jobs, and keep conversations moving.'
                    : 'Add service details, portfolio work, and verification so clients trust your business.'}
                </p>
              </div>
            </div>
            <Link
              href={vendorSummary?.bookingRequests ? '/dashboard/bookings' : '/dashboard/my-business'}
              className="btn-primary px-4 py-2.5 text-sm justify-center"
            >
              {vendorSummary?.bookingRequests ? 'Open bookings' : 'Update profile'}
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-7">
        {dashboardLoading ? (
          <>
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
          </>
        ) : metrics.map((m) => {
          const Icon = m.icon
          const tone = metricToneStyles[m.tone]
          return (
          <div key={m.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 leading-tight">{m.label}</p>
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className={`font-display text-2xl sm:text-3xl font-bold my-1 ${tone.value}`}>{m.value}</p>
            <p className={`text-xs font-medium ${tone.change}`}>{m.change}</p>
          </div>
        )})}
      </div>

      <div className="mb-5 sm:mb-7">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              {isVendorDashboard ? 'Run your business' : 'Quick actions'}
            </h2>
            <p className="text-sm text-slate-500">
              {isVendorDashboard ? 'The everyday tools for client work.' : 'Start or manage your service requests.'}
            </p>
          </div>
        </div>
        <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${
          isClientDashboard || isVendorDashboard ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'
        }`}>
          {quickActions.map((a) => {
            const Icon = a.icon
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-[0_8px_20px_rgba(15,23,42,0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{a.label}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{a.sub}</p>
                </div>
              </Link>
            )
          })}
        </div>
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
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                {isClientDashboard ? <SearchIcon className="h-6 w-6" /> : isVendorDashboard ? <BookingsIcon className="h-6 w-6" /> : <BriefcaseIcon className="h-6 w-6" />}
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {isClientDashboard ? 'No bookings yet' : isVendorDashboard ? 'No client requests yet' : 'No recent activity'}
              </p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {isClientDashboard
                  ? 'Find a trusted vendor near you and your updates will appear here.'
                  : isVendorDashboard
                    ? 'Client requests and booking updates will appear here when they start coming in.'
                    : 'New project updates will appear here.'}
              </p>
              {isClientDashboard && (
                <Link href="/professionals" className="btn-primary mt-4 px-5 py-2.5 text-sm">
                  Find vendors
                </Link>
              )}
              {isVendorDashboard && (
                <Link href="/dashboard/my-business" className="btn-primary mt-4 px-5 py-2.5 text-sm">
                  Improve business profile
                </Link>
              )}
            </div>
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

function BookingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M17 14h.01" />
    </svg>
  )
}
