'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type Counts = { total: number; active: number; completed: number; cancelled: number; quotes: number; acceptedQuotes: number }
type Report = { role: 'client' | 'artisan'; period: { start: string; end: string }; current: Counts; previous: Counts }
type Metric = { label: string; value: number; previous: number; tone: 'brand' | 'amber' | 'green' | 'blue'; icon: 'requests' | 'active' | 'done' | 'quotes' }

function change(current: number, previous: number) {
  if (previous === 0) return current ? { label: 'New this week', direction: 'up' } : { label: 'No change', direction: 'flat' }
  const percent = Math.round(((current - previous) / previous) * 100)
  return { label: `${Math.abs(percent)}% from last week`, direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat' }
}

export default function WeeklyReportPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (userLoading || !user) return
    fetch('/api/weekly-report')
      .then(async response => {
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(body.error || 'Could not load your weekly report')
        setReport(body.data)
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load your weekly report'))
  }, [user, userLoading])

  if (userLoading || (!report && !error)) return <WeeklyReportSkeleton />
  if (!user || (user.role !== 'client' && user.role !== 'artisan')) return <MessageState message="Weekly reports are available to clients and artisans." />
  if (error) return <MessageState message={error} warning />

  const current = report!.current
  const previous = report!.previous
  const isArtisan = report!.role === 'artisan'
  const metrics: Metric[] = [
    { label: isArtisan ? 'Service requests' : 'Services requested', value: current.total, previous: previous.total, tone: 'brand', icon: 'requests' },
    { label: isArtisan ? 'Active jobs' : 'Active bookings', value: current.active, previous: previous.active, tone: 'amber', icon: 'active' },
    { label: 'Jobs completed', value: current.completed, previous: previous.completed, tone: 'green', icon: 'done' },
    { label: 'Quotes accepted', value: current.acceptedQuotes, previous: previous.acceptedQuotes, tone: 'blue', icon: 'quotes' },
  ]
  const start = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(new Date(report!.period.start))
  const end = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(new Date(report!.period.end).getTime() - 1))

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-7">
      <header className="friendly-hero grid min-h-[184px] grid-cols-[minmax(0,1fr)_106px] items-center gap-1 p-5 sm:min-h-[224px] sm:grid-cols-[minmax(0,1fr)_210px] sm:p-8">
        <div className="relative z-10 min-w-0">
          <span className="friendly-pill text-white/80">{start} – {end}</span>
          <h1 className="mt-3 text-balance font-display text-2xl font-extrabold tracking-tight text-white sm:text-4xl">Your week on Anywork365</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/70 sm:text-base">A simple view of your booking activity and progress.</p>
        </div>
        <Image src="/images/booking/booking-tracker.webp" alt="" width={240} height={240} priority className="relative z-10 h-auto w-full object-contain drop-shadow-[0_16px_18px_rgba(0,0,0,0.24)]" />
        <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-[#d8ffad]/10" />
      </header>

      <section aria-labelledby="weekly-numbers-heading">
        <div className="mb-3 px-1 sm:mb-4">
          <h2 id="weekly-numbers-heading" className="font-display text-lg font-extrabold text-slate-900 sm:text-xl">This week</h2>
          <p className="mt-1 text-sm text-slate-500">Compared with your previous week.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {metrics.map(metric => <MetricCard key={metric.label} metric={metric} />)}
        </div>
      </section>

      <section className="solid-3d-card overflow-hidden p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="solid-3d-icon h-14 w-14 bg-[#dff0d2] text-brand-700"><SparkIcon /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-600">Weekly highlight</p>
            <h2 className="mt-1 font-display text-xl font-extrabold text-slate-900">{highlightTitle(isArtisan, current)}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{highlightCopy(isArtisan, current)}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
          <Link href={isArtisan ? '/dashboard/bookings' : '/bookings'} className="btn-primary w-full justify-center sm:w-auto">View bookings</Link>
          <Link href={isArtisan ? '/dashboard/wallet' : '/wallet'} className="btn-outline w-full justify-center sm:w-auto">View wallet</Link>
        </div>
      </section>

      <section className="solid-3d-well grid grid-cols-3 gap-2 p-3 sm:gap-4 sm:p-5" aria-label="Additional weekly activity">
        <SmallStat label="Quotes received" value={current.quotes} />
        <SmallStat label="Accepted" value={current.acceptedQuotes} />
        <SmallStat label="Cancelled" value={current.cancelled} />
      </section>
    </div>
  )
}

function MetricCard({ metric }: { metric: Metric }) {
  const delta = change(metric.value, metric.previous)
  const tones = { brand: 'bg-brand-100 text-brand-700', amber: 'bg-amber-100 text-amber-700', green: 'bg-emerald-100 text-emerald-700', blue: 'bg-sky-100 text-sky-700' }
  return (
    <article className="solid-3d-card min-w-0 p-4 sm:p-5">
      <MetricIcon kind={metric.icon} className={tones[metric.tone]} />
      <p className="mt-4 text-3xl font-black tabular-nums text-slate-900 sm:text-4xl">{metric.value}</p>
      <p className="mt-1 min-h-10 text-xs font-bold leading-5 text-slate-600 sm:text-sm">{metric.label}</p>
      <p className={`mt-2 text-[11px] font-semibold leading-4 ${delta.direction === 'down' ? 'text-amber-700' : delta.direction === 'up' ? 'text-brand-700' : 'text-slate-400'}`}>
        {delta.direction === 'up' ? '↑ ' : delta.direction === 'down' ? '↓ ' : '→ '}{delta.label}
      </p>
    </article>
  )
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-2xl bg-white/65 px-2 py-3 text-center shadow-[inset_0_1px_0_white] sm:px-4"><p className="text-xl font-black tabular-nums text-slate-900 sm:text-2xl">{value}</p><p className="mt-1 text-[10px] font-bold leading-4 text-slate-500 sm:text-xs">{label}</p></div>
}

function WeeklyReportSkeleton() {
  return <div className="mx-auto w-full max-w-6xl space-y-5"><div className="h-48 animate-pulse rounded-[2rem] bg-brand-800/20"/><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-44 animate-pulse rounded-3xl bg-slate-100"/>)}</div></div>
}

function MessageState({ message, warning = false }: { message: string; warning?: boolean }) {
  return <div className={`solid-3d-card mx-auto max-w-xl p-8 text-center text-sm ${warning ? 'text-amber-700' : 'text-slate-500'}`}>{message}</div>
}

function highlightTitle(isArtisan: boolean, current: Counts) {
  if (isArtisan && current.completed > 0) return `${current.completed} job${current.completed === 1 ? '' : 's'} completed`
  if (!isArtisan && current.total > 0) return `${current.total} service request${current.total === 1 ? '' : 's'} this week`
  return 'Your next win starts here'
}

function highlightCopy(isArtisan: boolean, current: Counts) {
  if (isArtisan && current.completed > 0) return `Great work. You also have ${current.active} active job${current.active === 1 ? '' : 's'} to keep moving.`
  if (!isArtisan && current.total > 0) return `You have ${current.active} active booking${current.active === 1 ? '' : 's'} and ${current.acceptedQuotes} accepted quote${current.acceptedQuotes === 1 ? '' : 's'}.`
  return isArtisan ? 'New requests, quotes, and completed jobs will appear here automatically.' : 'Request a service and your weekly activity will appear here automatically.'
}

function MetricIcon({ kind, className }: { kind: Metric['icon']; className: string }) {
  return <span className={`solid-3d-icon h-11 w-11 ${className}`}>
    {kind === 'requests' && <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/></svg>}
    {kind === 'active' && <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
    {kind === 'done' && <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>}
    {kind === 'quotes' && <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h4"/></svg>}
  </span>
}

function SparkIcon() {
  return <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>
}
