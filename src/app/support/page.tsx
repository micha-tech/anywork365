'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'

type ProgressFilter = '' | 'attention' | 'in-progress' | 'almost' | 'complete'
type DetailTab = 'overview' | 'bookings' | 'transactions' | 'wallet'

interface SupportUser {
  uid: string
  email: string
  fullName: string
  phoneNumber: string
  state: string
  lga: string | null
  profileImage: string
  role: string
  category: string
  dateJoined: string
  walletBalance: number
  bookingCount: number
  lastActivityAt: string
  profileCompletion: number
  missingSteps: string[]
}

interface UserDetail {
  user: Record<string, string | number | null>
  wallet: {
    balance: number
    currency: string
    walletStatus: string
    transactionCount: number
  } | null
  transactions: Array<Record<string, string | number | null>>
  bookings: Array<Record<string, string | number | null>>
}

interface Summary {
  averageCompletion: number
  needsAttention: number
  completeProfiles: number
}

const EMPTY_SUMMARY: Summary = { averageCompletion: 0, needsAttention: 0, completeProfiles: 0 }

function formatMoney(value: unknown) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value: unknown, withTime = false) {
  if (!value) return 'Not available'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AW'
}

function progressMeta(value: number) {
  if (value === 100) return { label: 'Complete', tone: 'text-emerald-700', bar: 'bg-emerald-500' }
  if (value >= 80) return { label: 'Almost there', tone: 'text-brand-600', bar: 'bg-brand-500' }
  if (value >= 50) return { label: 'In progress', tone: 'text-amber-700', bar: 'bg-amber-500' }
  return { label: 'Needs attention', tone: 'text-rose-600', bar: 'bg-rose-500' }
}

function ProfileProgress({ value, compact = false }: { value: number; compact?: boolean }) {
  const meta = progressMeta(value)
  return (
    <div className={compact ? 'min-w-[150px]' : 'w-full'}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className={`text-[11px] font-semibold ${meta.tone}`}>{meta.label}</span>
        <span className="text-xs font-bold tabular-nums text-slate-700">{value}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`Profile ${value}% complete`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full transition-[width] duration-500 ${meta.bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function Avatar({ user, large = false }: { user: SupportUser; large?: boolean }) {
  const size = large ? 'h-16 w-16 text-lg' : 'h-10 w-10 text-xs'
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-500 font-bold text-white ${size}`}>
      {user.profileImage ? (
        <Image src={user.profileImage} alt="" fill sizes={large ? '64px' : '40px'} className="object-cover" />
      ) : initials(user.fullName)}
    </div>
  )
}

export default function SupportDashboardPage() {
  const [users, setUsers] = useState<SupportUser[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY)
  const [categories, setCategories] = useState<string[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [category, setCategory] = useState('')
  const [progress, setProgress] = useState<ProgressFilter>('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<SupportUser | null>(null)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const limit = 20

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set('search', search)
    if (role) params.set('role', role)
    if (category) params.set('category', category)
    if (progress) params.set('progress', progress)

    try {
      const response = await fetch(`/api/admin/support-users?${params}`)
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not load users')
      setUsers(body.data)
      setTotal(body.total)
      setSummary(body.summary)
      setCategories(body.categories)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load users')
    } finally {
      setLoading(false)
    }
  }, [category, page, progress, role, search])

  useEffect(() => { void loadUsers() }, [loadUsers])

  useEffect(() => {
    if (!selected) return
    setDetailLoading(true)
    setDetail(null)
    fetch(`/api/admin/support-users/${encodeURIComponent(selected.uid)}`)
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(body.error || 'Could not load details')
        setDetail(body.data)
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selected])

  useEffect(() => {
    if (!selected) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selected])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const filtersActive = Boolean(searchInput || role || category || progress)
  const firstResult = total === 0 ? 0 : (page - 1) * limit + 1
  const lastResult = Math.min(page * limit, total)

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setRole('')
    setCategory('')
    setProgress('')
    setPage(1)
  }

  const selectUser = (user: SupportUser) => {
    setSelected(user)
    setDetailTab('overview')
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-7 lg:px-8 lg:py-8">
      <section className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-500">User success</p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Profile setup progress
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Find people who need support, see where setup stopped, and help them reach a complete profile.
          </p>
        </div>
        <p className="w-fit rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm">
          Data updates when this page is refreshed
        </p>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Users in view" value={total.toLocaleString()} note="Matching this support queue" accent="brand" />
        <MetricCard label="Average setup" value={`${summary.averageCompletion}%`} note="Across matching users" accent="blue" />
        <MetricCard label="Need attention" value={summary.needsAttention.toLocaleString()} note="Below 50% complete" accent="rose" />
        <MetricCard label="Profiles complete" value={summary.completeProfiles.toLocaleString()} note="Ready to be discovered" accent="emerald" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-100 p-4 md:p-5">
          <div className="flex flex-col gap-3 xl:flex-row">
            <label className="relative flex min-h-11 flex-1 items-center">
              <span className="absolute left-3.5 text-lg text-slate-400" aria-hidden="true">⌕</span>
              <span className="sr-only">Search users</span>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name, email or user ID"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex">
              <FilterSelect label="Role" value={role} onChange={(value) => { setRole(value); setPage(1) }}>
                <option value="">All roles</option>
                <option value="client">Clients</option>
                <option value="artisan">Artisans</option>
                <option value="professional">Professionals</option>
                <option value="recruiter">Recruiters</option>
              </FilterSelect>
              <FilterSelect label="Category" value={category} onChange={(value) => { setCategory(value); setPage(1) }}>
                <option value="">All categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </FilterSelect>
              <FilterSelect label="Progress" value={progress} onChange={(value) => { setProgress(value as ProgressFilter); setPage(1) }}>
                <option value="">All progress</option>
                <option value="attention">Needs attention</option>
                <option value="in-progress">In progress</option>
                <option value="almost">Almost there</option>
                <option value="complete">Complete</option>
              </FilterSelect>
            </div>
          </div>
          <div className="mt-3 flex min-h-6 items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {loading ? 'Updating queue…' : `${total.toLocaleString()} ${total === 1 ? 'user' : 'users'} found`}
            </p>
            {filtersActive && (
              <button onClick={clearFilters} className="text-xs font-semibold text-brand-500 hover:text-brand-700">
                Clear filters
              </button>
            )}
          </div>
        </div>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <p className="font-semibold text-slate-800">We could not load the support queue.</p>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
            <button onClick={() => void loadUsers()} className="mt-4 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">
              Try again
            </button>
          </div>
        ) : loading ? (
          <LoadingRows />
        ) : users.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-xl text-brand-500">⌕</div>
            <p className="mt-4 font-semibold text-slate-800">No users match these filters</p>
            <p className="mt-1 text-sm text-slate-500">Try a broader category or setup stage.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] table-fixed text-left">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    <th className="w-[25%] px-5 py-3.5">User</th>
                    <th className="w-[20%] px-4 py-3.5">Contact</th>
                    <th className="w-[15%] px-4 py-3.5">Category</th>
                    <th className="w-[20%] px-4 py-3.5">Profile setup</th>
                    <th className="w-[12%] px-4 py-3.5">Activity</th>
                    <th className="w-[8%] px-4 py-3.5"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.uid}
                      onClick={() => selectUser(user)}
                      className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-brand-50/40"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar user={user} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{user.fullName || 'Unnamed user'}</p>
                            <p className="mt-0.5 capitalize text-xs text-slate-400">{user.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="truncate text-xs font-medium text-slate-700">{user.email}</p>
                        <p className="mt-1 text-xs text-slate-400">{user.phoneNumber || 'No phone number'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex max-w-full truncate rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {user.category}
                        </span>
                      </td>
                      <td className="px-4 py-4"><ProfileProgress value={user.profileCompletion} compact /></td>
                      <td className="px-4 py-4">
                        <p className="text-xs font-semibold text-slate-700">{user.bookingCount} bookings</p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatDate(user.lastActivityAt)}</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={(event) => { event.stopPropagation(); selectUser(user) }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lg text-slate-400 transition hover:border-brand-300 hover:bg-white hover:text-brand-500"
                          aria-label={`View ${user.fullName}`}
                        >
                          →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {users.map((user) => (
                <button key={user.uid} onClick={() => selectUser(user)} className="block w-full p-4 text-left active:bg-brand-50">
                  <div className="flex items-start gap-3">
                    <Avatar user={user} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{user.fullName || 'Unnamed user'}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-400">{user.email}</p>
                        </div>
                        <span className="shrink-0 text-lg text-slate-300">→</span>
                      </div>
                      <div className="mt-3"><ProfileProgress value={user.profileCompletion} /></div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                        <span className="truncate rounded-md bg-slate-100 px-2 py-1">{user.category}</span>
                        <span className="shrink-0">{user.bookingCount} bookings</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {!loading && !error && total > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
            <p className="text-xs text-slate-400">Showing {firstResult}–{lastResult} of {total.toLocaleString()}</p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 text-xs font-medium text-slate-500">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {selected && (
        <UserDrawer
          user={selected}
          detail={detail}
          loading={detailLoading}
          tab={detailTab}
          onTabChange={setDetailTab}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  note,
  accent,
}: {
  label: string
  value: string
  note: string
  accent: 'brand' | 'blue' | 'rose' | 'emerald'
}) {
  const tone = {
    brand: 'bg-brand-50 text-brand-500',
    blue: 'bg-sky-50 text-sky-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  }[accent]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 hidden text-[11px] text-slate-400 sm:block">{note}</p>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 sm:min-w-[150px]"
      >
        {children}
      </select>
    </label>
  )
}

function LoadingRows() {
  return (
    <div className="divide-y divide-slate-100" aria-label="Loading users">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-5">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100" />
          <div className="w-1/4 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="ml-auto hidden h-2 w-1/3 animate-pulse rounded-full bg-slate-100 sm:block" />
        </div>
      ))}
    </div>
  )
}

function UserDrawer({
  user,
  detail,
  loading,
  tab,
  onTabChange,
  onClose,
}: {
  user: SupportUser
  detail: UserDetail | null
  loading: boolean
  tab: DetailTab
  onTabChange: (tab: DetailTab) => void
  onClose: () => void
}) {
  const tabs = useMemo<Array<{ id: DetailTab; label: string }>>(() => [
    { id: 'overview', label: 'Overview' },
    { id: 'bookings', label: `Bookings${detail ? ` · ${detail.bookings.length}` : ''}` },
    { id: 'transactions', label: `Transactions${detail ? ` · ${detail.transactions.length}` : ''}` },
    { id: 'wallet', label: 'Wallet' },
  ], [detail])

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Close user details" />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-[680px] flex-col bg-[#f8fafa] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`${user.fullName} support details`}
      >
        <header className="border-b border-slate-200 bg-white px-4 pb-5 pt-4 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">User profile</p>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500 hover:bg-slate-200"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="mt-3 flex items-start gap-4">
            <Avatar user={user} large />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold text-slate-950">{user.fullName || 'Unnamed user'}</h2>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-600">{user.role}</span>
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">{user.email}</p>
              <div className="mt-4 max-w-sm"><ProfileProgress value={user.profileCompletion} /></div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`mailto:${user.email}`} className="inline-flex min-h-10 items-center rounded-xl bg-brand-500 px-4 text-xs font-semibold text-white">
              Email user
            </a>
            {user.phoneNumber && (
              <a href={`tel:${user.phoneNumber}`} className="inline-flex min-h-10 items-center rounded-xl border border-brand-500 px-4 text-xs font-semibold text-brand-500">
                Call {user.phoneNumber}
              </a>
            )}
          </div>
        </header>

        <div className="border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold transition-colors ${
                  tab === item.id ? 'border-brand-500 text-brand-500' : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
              <div className="h-52 animate-pulse rounded-2xl bg-slate-200/70" />
            </div>
          ) : !detail ? (
            <div className="rounded-2xl border border-rose-100 bg-white p-6 text-center text-sm text-slate-500">
              Details are temporarily unavailable.
            </div>
          ) : tab === 'overview' ? (
            <OverviewTab user={user} detail={detail} />
          ) : tab === 'bookings' ? (
            <BookingsTab bookings={detail.bookings} />
          ) : tab === 'transactions' ? (
            <TransactionsTab transactions={detail.transactions} />
          ) : (
            <WalletTab wallet={detail.wallet} transactions={detail.transactions} />
          )}
        </div>
      </aside>
    </div>
  )
}

function OverviewTab({ user, detail }: { user: SupportUser; detail: UserDetail }) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Setup checklist</h3>
            <p className="mt-1 text-xs text-slate-400">
              {user.missingSteps.length ? `${user.missingSteps.length} steps still need attention` : 'Every required step is complete'}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${user.missingSteps.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {user.missingSteps.length ? 'FOLLOW UP' : 'COMPLETE'}
          </span>
        </div>
        {user.missingSteps.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {user.missingSteps.map((step) => (
              <span key={step} className="rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                {step}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">This profile is ready for customers.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Account information</h3>
        <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <InfoItem label="Email" value={user.email} />
          <InfoItem label="Phone" value={user.phoneNumber || 'Not provided'} />
          <InfoItem label="Category" value={user.category} />
          <InfoItem label="Location" value={[user.lga, user.state].filter(Boolean).join(', ') || 'Not provided'} />
          <InfoItem label="Joined" value={formatDate(user.dateJoined)} />
          <InfoItem label="Last activity" value={formatDate(user.lastActivityAt, true)} />
          <InfoItem label="Bookings" value={`${user.bookingCount}`} />
          <InfoItem label="Wallet balance" value={formatMoney(user.walletBalance)} />
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Role details</h3>
        <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          {user.role === 'artisan' && (
            <>
              <InfoItem label="Business name" value={detail.user.businessName} />
              <InfoItem label="Business contact" value={detail.user.businessContact} />
              <InfoItem label="Business location" value={detail.user.businessLocation} />
            </>
          )}
          {user.role === 'professional' && (
            <>
              <InfoItem label="Industry" value={detail.user.industryCategory} />
              <InfoItem label="Job title" value={detail.user.jobTitle} />
              <InfoItem label="Qualification" value={detail.user.qualification} />
              <InfoItem label="Experience" value={detail.user.yearsExperience === null ? null : `${detail.user.yearsExperience} years`} />
            </>
          )}
          {user.role === 'recruiter' && (
            <>
              <InfoItem label="Company" value={detail.user.companyName} />
              <InfoItem label="Company size" value={detail.user.companySize} />
              <InfoItem label="Recruitment function" value={detail.user.recruitmentFunction} />
              <InfoItem label="Position" value={detail.user.position} />
            </>
          )}
          {user.role === 'client' && (
            <p className="col-span-full text-xs leading-5 text-slate-500">This is a customer account, so no provider or recruiter details are required.</p>
          )}
        </dl>
      </section>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-700">{value === null || value === undefined || value === '' ? 'Not provided' : String(value)}</dd>
    </div>
  )
}

function BookingsTab({ bookings }: { bookings: UserDetail['bookings'] }) {
  if (!bookings.length) return <EmptyDetail title="No bookings yet" note="This user has no customer or provider bookings." />
  return (
    <div className="space-y-3">
      {bookings.map((booking) => (
        <article key={String(booking.bookingId)} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{booking.serviceTitle || 'Service booking'}</p>
              <p className="mt-1 text-xs text-slate-400">#{booking.bookingCode || booking.bookingId} · {booking.involvement}</p>
            </div>
            <StatusPill value={String(booking.bookingStatus || 'Pending')} />
          </div>
          <div className="mt-4 flex items-end justify-between gap-4 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400">{formatDate(booking.dateBooked)}</p>
            <p className="text-sm font-bold text-slate-800">{formatMoney(booking.amountAgreed)}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

function TransactionsTab({ transactions }: { transactions: UserDetail['transactions'] }) {
  if (!transactions.length) return <EmptyDetail title="No transactions yet" note="Wallet activity will appear here once the user makes a transaction." />
  return (
    <div className="space-y-3">
      {transactions.map((transaction) => {
        const credit = transaction.direction === 'credit'
        return (
          <article key={String(transaction.id)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${credit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {credit ? '↓' : '↑'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{transaction.description || transaction.type || 'Wallet transaction'}</p>
              <p className="mt-1 text-[11px] text-slate-400">{formatDate(transaction.createdAt, true)}</p>
            </div>
            <p className={`text-sm font-bold ${credit ? 'text-emerald-600' : 'text-slate-800'}`}>
              {credit ? '+' : '−'}{formatMoney(transaction.amount)}
            </p>
          </article>
        )
      })}
    </div>
  )
}

function WalletTab({ wallet, transactions }: { wallet: UserDetail['wallet']; transactions: UserDetail['transactions'] }) {
  if (!wallet) return <EmptyDetail title="No wallet found" note="A wallet has not been created for this user." />
  const credits = transactions.filter((item) => item.direction === 'credit').reduce((total, item) => total + Number(item.amount || 0), 0)
  const debits = transactions.filter((item) => item.direction === 'debit').reduce((total, item) => total + Number(item.amount || 0), 0)
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl bg-brand-500 p-5 text-white shadow-[0_16px_35px_rgba(15,79,74,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/60">Available balance</p>
        <p className="mt-3 text-3xl font-bold tracking-tight">{formatMoney(wallet.balance)}</p>
        <div className="mt-6 flex items-center justify-between text-xs text-white/70">
          <span>{wallet.currency || 'NGN'} wallet</span>
          <span className="capitalize">{wallet.walletStatus || 'active'}</span>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Recent credits</p>
          <p className="mt-2 text-lg font-bold text-emerald-600">{formatMoney(credits)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Recent debits</p>
          <p className="mt-2 text-lg font-bold text-slate-800">{formatMoney(debits)}</p>
        </div>
      </div>
      <p className="px-1 text-xs text-slate-400">Showing totals from the {transactions.length} most recent wallet entries.</p>
    </div>
  )
}

function EmptyDetail({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">{note}</p>
    </div>
  )
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const tone = normalized.includes('complete') || normalized.includes('confirm')
    ? 'bg-emerald-50 text-emerald-700'
    : normalized.includes('cancel') || normalized.includes('reject')
      ? 'bg-rose-50 text-rose-700'
      : 'bg-amber-50 text-amber-700'
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${tone}`}>{value}</span>
}
