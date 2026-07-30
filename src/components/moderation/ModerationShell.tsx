'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BrandWordmark } from '@/components/layout/BrandLogo'
import { logoutCurrentUser } from '@/lib/clientLogout'

const sections = [
  { id: 'overview', label: 'Operations overview', group: 'Financial control' },
  { id: 'ledger', label: 'Ledger journal', group: 'Financial control' },
  { id: 'job_funds', label: 'Job funds', group: 'Financial control' },
  { id: 'withdrawals', label: 'Withdrawals', group: 'Money movement' },
  { id: 'refunds', label: 'Refunds', group: 'Money movement' },
  { id: 'risk', label: 'Risk and disputes', group: 'Money movement' },
  { id: 'users', label: 'Customer accounts', group: 'Oversight' },
  { id: 'audit', label: 'Audit history', group: 'Oversight' },
] as const

export function ModerationShell({
  children,
  operator,
}: {
  children: React.ReactNode
  operator: { email: string; name: string }
}) {
  const searchParams = useSearchParams()
  const active = searchParams.get('view') || 'overview'
  const groups = Array.from(new Set(sections.map((item) => item.group)))

  async function signOut() {
    await logoutCurrentUser()
    window.location.assign('/login')
  }

  return (
    <div className="min-h-screen bg-[#f5f7f7] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-[76px] items-center border-b border-slate-200 px-6">
          <BrandWordmark href="/home" className="w-[178px]" priority />
        </div>
        <div className="border-b border-slate-100 px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-500">
            Moderation
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{operator.name}</p>
          <p className="truncate text-xs text-slate-500">{operator.email}</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group} className="mb-5">
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {group}
              </p>
              {sections.filter((item) => item.group === group).map((item) => {
                const selected = active === item.id
                return (
                  <Link
                    key={item.id}
                    href={`/moderation?view=${item.id}`}
                    className={`mb-0.5 flex min-h-10 items-center rounded-lg border-l-2 px-3 text-sm transition-colors ${
                      selected
                        ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700'
                        : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <Link href="/admin" className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Administration
          </Link>
          <Link href="/support" className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Customer support
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-500 lg:hidden">
                Anywork365 Moderation
              </p>
              <p className="text-sm font-semibold text-slate-900">Financial Operations Console</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Live environment
              </span>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden">
            {sections.map((item) => (
              <Link
                key={item.id}
                href={`/moderation?view=${item.id}`}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${
                  active === item.id ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  )
}
