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
      <main className="relative min-w-0 flex-1 bg-surface-base px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
