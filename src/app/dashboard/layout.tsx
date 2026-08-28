import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { DashboardSidebar } from '@/components/layout/DashboardSidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (session && !session.emailVerified) {
    redirect('/verify-email')
  }

  if (session?.role === 'admin') {
    redirect('/admin')
  }
  if (session?.role === 'support') {
    redirect('/support')
  }

  return (
    <div className="flex min-h-[calc(100dvh-64px)]">
      {/* Sidebar - desktop only */}
      {(session.role === 'artisan' || session.role === 'recruiter') && <DashboardSidebar />}

      {/* Main content */}
      <main className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_100%_0%,rgba(114,199,195,0.12),transparent_26rem),linear-gradient(180deg,#fbfdfc_0%,#f5f8f7_100%)] px-4 py-5 pb-28 sm:px-8 sm:py-8 sm:pb-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
