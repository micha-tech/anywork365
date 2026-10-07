'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type Counts = { total: number; active: number; completed: number; cancelled: number; quotes: number; acceptedQuotes: number }
type Report = { role: 'client' | 'artisan'; period: { start: string; end: string }; current: Counts; previous: Counts }

function change(current: number, previous: number) {
  if (previous === 0) return current ? 'New this week' : 'No change'
  const percent = Math.round(((current - previous) / previous) * 100)
  return `${percent > 0 ? '↑' : percent < 0 ? '↓' : '→'} ${Math.abs(percent)}% from last week`
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

  if (userLoading || (!report && !error)) return <div className="py-20 text-center text-sm text-slate-500">Loading your week…</div>
  if (!user || (user.role !== 'client' && user.role !== 'artisan')) return <div className="py-20 text-center text-sm text-slate-500">Weekly reports are available to clients and artisans.</div>
  if (error) return <div className="py-20 text-center text-sm text-amber-700">{error}</div>

  const current = report!.current
  const previous = report!.previous
  const isArtisan = report!.role === 'artisan'
  const cards = isArtisan
    ? [
        ['Service requests', current.total, previous.total],
        ['Active jobs', current.active, previous.active],
        ['Jobs completed', current.completed, previous.completed],
        ['Quotes accepted', current.acceptedQuotes, previous.acceptedQuotes],
      ]
    : [
        ['Services requested', current.total, previous.total],
        ['Active bookings', current.active, previous.active],
        ['Jobs completed', current.completed, previous.completed],
        ['Quotations accepted', current.acceptedQuotes, previous.acceptedQuotes],
      ]
  const start = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(new Date(report!.period.start))
  const end = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(new Date(report!.period.end).getTime() - 1))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-3xl border border-brand-100 bg-[#efffde] p-6">
        <p className="text-sm font-semibold text-brand-700">Weekly report</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">Your week on Anywork365</h1>
        <p className="mt-2 text-sm text-slate-600">{start} – {end}. This report refreshes from your booking activity.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value, before]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value}</p><p className="mt-2 text-xs font-medium text-brand-700">{change(Number(value), Number(before))}</p></article>)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-slate-900">This week at a glance</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {isArtisan
            ? current.completed > 0 ? `Great work — you completed ${current.completed} job${current.completed === 1 ? '' : 's'} this week.` : 'Your next completed job will appear here.'
            : current.total > 0 ? `You made ${current.total} service request${current.total === 1 ? '' : 's'} this week.` : 'When you request a service, your activity will appear here.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={isArtisan ? '/dashboard/bookings' : '/bookings'} className="btn-primary">View bookings</Link>
          <Link href={isArtisan ? '/dashboard/wallet' : '/wallet'} className="btn-outline">View wallet</Link>
        </div>
      </section>
    </div>
  )
}
