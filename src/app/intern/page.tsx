import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getVerifiedSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function InternHomePage() {
  const session = await getVerifiedSession()
  if (!session) redirect('/login')
  if (session.role !== 'intern') redirect('/home')

  return (
    <main className="page-shell px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-3xl border border-brand-100 bg-[#efffde] p-6 sm:p-10">
          <p className="text-sm font-semibold text-brand-700">Your intern space</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Keep learning. Find your next opportunity.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Explore roles, discover practical experience and keep your profile ready for hiring teams.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/jobs" className="btn-primary px-6 py-3 text-center">Explore opportunities</Link>
            <Link href="/profile" className="btn-ghost px-6 py-3 text-center">Complete my profile</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
