'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { logoutCurrentUser } from '@/lib/clientLogout'

const socialLinks = [
  ['Instagram', process.env.NEXT_PUBLIC_ANYWORK365_INSTAGRAM_URL],
  ['Facebook', process.env.NEXT_PUBLIC_ANYWORK365_FACEBOOK_URL],
  ['X', process.env.NEXT_PUBLIC_ANYWORK365_X_URL],
  ['LinkedIn', process.env.NEXT_PUBLIC_ANYWORK365_LINKEDIN_URL],
].filter((item): item is [string, string] => Boolean(item[1]))

export default function SettingsPage() {
  const { user, loading } = useCurrentUser()
  const router = useRouter()
  const isArtisan = user?.role === 'artisan'

  async function logout() {
    await logoutCurrentUser()
    router.push('/')
    router.refresh()
  }

  if (loading) return <div className="py-20 text-center text-sm text-slate-500">Loading settings…</div>
  if (!user) return <div className="py-20 text-center text-sm text-slate-500">Please sign in to manage your settings.</div>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header><h1 className="page-heading">Settings</h1><p className="mt-1 text-sm text-slate-500">Manage your account, alerts, and support options.</p></header>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Link href={isArtisan ? '/dashboard/profile' : '/profile'} className="flex items-center justify-between border-b border-slate-100 px-5 py-4 text-sm font-medium text-slate-800 hover:bg-slate-50"><span>Profile</span><span aria-hidden>›</span></Link>
        <Link href={isArtisan ? '/dashboard/notifications' : '/notifications'} className="flex items-center justify-between border-b border-slate-100 px-5 py-4 text-sm font-medium text-slate-800 hover:bg-slate-50"><span>Notifications</span><span aria-hidden>›</span></Link>
        <Link href="/support" className="flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-800 hover:bg-slate-50"><span>Support</span><span aria-hidden>›</span></Link>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Share Anywork365</h2>
        <p className="mt-1 text-sm text-slate-500">Tell someone who needs a trusted artisan or professional.</p>
        <button type="button" onClick={() => navigator.share?.({ title: 'Anywork365', url: window.location.origin })} className="btn-outline mt-4">Share the app</button>
      </section>
      {socialLinks.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Follow Anywork365</h2><div className="mt-3 flex flex-wrap gap-3">{socialLinks.map(([name, href]) => <a key={name} href={href} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-700 hover:text-brand-800">{name}</a>)}</div></section>}
      <button type="button" onClick={() => void logout()} className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50">Log out</button>
    </div>
  )
}
