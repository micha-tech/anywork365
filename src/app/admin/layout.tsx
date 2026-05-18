import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { requireAdmin } from '@/lib/admin'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const _session = await requireAdmin()

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center gap-3">
          <Link href="/admin" className="text-sm font-semibold text-brand-500">
            Admin Panel
          </Link>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs text-slate-500">{_session.email}</span>
        </div>
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
