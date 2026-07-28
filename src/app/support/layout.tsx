import Link from 'next/link'
import { BrandWordmark } from '@/components/layout/BrandLogo'
import { requireSupport } from '@/lib/admin'

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSupport()

  return (
    <div className="min-h-dvh bg-[#f5f7f7] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-slate-200 bg-white px-4 py-6 lg:flex lg:flex-col">
        <BrandWordmark href="/support" className="w-[188px]" priority />

        <div className="mt-8 rounded-2xl bg-brand-500 px-4 py-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">Workspace</p>
          <p className="mt-1 text-sm font-semibold">Customer Support</p>
          <span className="mt-3 inline-flex rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
            View only
          </span>
        </div>

        <nav className="mt-7" aria-label="Support navigation">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Support desk</p>
          <Link
            href="/support"
            className="mt-2 flex items-center gap-3 rounded-xl bg-brand-50 px-3 py-3 text-sm font-semibold text-brand-500"
          >
            <span className="grid h-7 w-7 grid-cols-2 gap-1 rounded-lg bg-brand-500 p-1.5" aria-hidden="true">
              <i className="rounded-[2px] bg-white/90" />
              <i className="rounded-[2px] bg-white/60" />
              <i className="rounded-[2px] bg-white/60" />
              <i className="rounded-[2px] bg-white/90" />
            </span>
            User progress
          </Link>
        </nav>

        <div className="mt-auto border-t border-slate-100 pt-5">
          <p className="truncate px-3 text-xs font-medium text-slate-700">{session.email}</p>
          <p className="mt-1 px-3 text-[11px] text-slate-400">Customer support</p>
          <Link
            href="/admin"
            className="mt-4 flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-500"
          >
            ← Back to admin
          </Link>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:px-7 lg:px-8">
          <div className="lg:hidden">
            <BrandWordmark href="/support" className="w-[150px]" />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Support console</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-500 sm:inline-flex">
              Read-only access
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {session.firstName?.[0]}{session.lastName?.[0]}
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
