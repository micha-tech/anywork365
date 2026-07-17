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

  return (
    <div className="flex min-h-[calc(100dvh-64px)]">
      {/* Sidebar - desktop only */}
      {session.role === 'vendor' && <DashboardSidebar />}

      {/* Main content */}
      <main className="flex-1 bg-surface-base overflow-y-auto px-4 sm:px-8 py-5 sm:py-8 pb-28 sm:pb-8">
        {children}
      </main>
    </div>
  )
}
