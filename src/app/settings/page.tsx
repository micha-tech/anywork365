'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { logoutCurrentUser } from '@/lib/clientLogout'

const socialLinks = [
  ['Instagram', process.env.NEXT_PUBLIC_ANYWORK365_INSTAGRAM_URL],
  ['Facebook', process.env.NEXT_PUBLIC_ANYWORK365_FACEBOOK_URL],
  ['X', process.env.NEXT_PUBLIC_ANYWORK365_X_URL],
  ['LinkedIn', process.env.NEXT_PUBLIC_ANYWORK365_LINKEDIN_URL],
].filter((item): item is [string, string] => Boolean(item[1]))

type SettingItem = {
  href: string
  label: string
  description: string
  icon: 'profile' | 'notifications' | 'report' | 'verification' | 'support'
  external?: boolean
}

type TierId = 'default' | 'bronze' | 'silver' | 'gold'

type TierPlan = {
  id: TierId
  name: string
  price: number
  eyebrow: string
  title: string
  description: string
  coverage: string
  ratings: string
  requirements: string
  benefits: string[]
  tone: string
}

const tierPlans: TierPlan[] = [
  {
    id: 'default',
    name: 'Default',
    price: 0,
    eyebrow: 'Starting tier',
    title: 'Build your track record',
    description: 'Complete your basic checks and start building trusted activity on Anywork365.',
    coverage: 'Visibility within your local government area',
    ratings: 'No rating milestone to start',
    requirements: 'NIN, utility bill, and a business reference after two completed tasks',
    benefits: ['Local visibility', 'Clear path to Bronze'],
    tone: 'from-slate-100 to-slate-200',
  },
  {
    id: 'bronze',
    name: 'Bronze',
    price: 10_000,
    eyebrow: 'Growing businesses',
    title: 'Reach more nearby clients',
    description: 'For verified vendors building a strong record of completed work and positive feedback.',
    coverage: 'Indicative visibility up to approximately 15 km²',
    ratings: '5 positive ratings from completed tasks',
    requirements: 'Registered business documents, utility bill, and NIN',
    benefits: ['Bronze verified badge', 'Expanded local visibility'],
    tone: 'from-[#f5dfcc] to-[#c98d5b]',
  },
  {
    id: 'silver',
    name: 'Silver',
    price: 20_000,
    eyebrow: 'Established providers',
    title: 'Stand out across more areas',
    description: 'Broader discovery for experienced vendors with a consistent verified service record.',
    coverage: 'Indicative visibility up to approximately 30 km²',
    ratings: '10 positive ratings from completed tasks',
    requirements: 'Registered business CAC documents, status report, MEMART, utility bill, and NIN',
    benefits: ['Silver verified badge', 'Public verified reviews'],
    tone: 'from-slate-50 to-slate-400',
  },
  {
    id: 'gold',
    name: 'Gold',
    price: 50_000,
    eyebrow: 'Highest visibility',
    title: 'Grow beyond your local area',
    description: 'The highest tier for fully documented providers with a proven record on the platform.',
    coverage: 'State-wide visibility and beyond, subject to platform policy',
    ratings: '20 positive ratings from completed tasks',
    requirements: 'Limited company CAC documents, status report, MEMART, and utility bill',
    benefits: ['Gold verified badge', 'Enhanced homepage visibility', 'Public verified reviews'],
    tone: 'from-[#fff4b8] to-[#e9b72e]',
  },
]

export default function SettingsPage() {
  const { user, loading } = useCurrentUser()
  const router = useRouter()
  const isArtisan = user?.role === 'artisan'

  async function logout() {
    await logoutCurrentUser()
    router.push('/')
    router.refresh()
  }

  async function shareApp() {
    const shareData = { title: 'Anywork365', text: 'Find trusted artisans and professionals on Anywork365.', url: window.location.origin }
    try {
      if (navigator.share) await navigator.share(shareData)
      else {
        await navigator.clipboard.writeText(window.location.origin)
        toast.success('Anywork365 link copied')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error('Could not share the app')
    }
  }

  if (loading) {
    return <div className="mx-auto min-h-[60dvh] max-w-5xl px-4 py-6 sm:px-6"><div className="h-48 animate-pulse rounded-[2rem] bg-brand-100" /></div>
  }
  if (!user) return <div className="px-4 py-20 text-center text-sm text-slate-500">Please sign in to manage your settings.</div>

  const items: SettingItem[] = [
    { href: isArtisan ? '/dashboard/profile' : '/profile', label: 'Profile', description: 'Update your personal information and account details.', icon: 'profile' },
    { href: isArtisan ? '/dashboard/notifications' : '/notifications', label: 'Notifications', description: 'Review booking, message, and platform alerts.', icon: 'notifications' },
    ...((user.role === 'client' || isArtisan) ? [{ href: '/dashboard/weekly-report', label: 'Weekly report', description: 'See your recent activity, progress, and completed work.', icon: 'report' as const }] : []),
    ...(isArtisan ? [{ href: '/dashboard/verify-business', label: 'Business verification', description: 'Submit documents and review your verification status.', icon: 'verification' as const }] : []),
    { href: 'mailto:support@anywork365.ng', label: 'Support', description: 'Contact the Anywork365 support team for help.', icon: 'support', external: true },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-8 pt-4 sm:space-y-7 sm:px-6 sm:py-8 lg:px-8">
      <header className="friendly-hero grid min-h-[176px] grid-cols-[minmax(0,1fr)_104px] items-center gap-2 p-5 sm:min-h-[220px] sm:grid-cols-[minmax(0,1fr)_190px] sm:p-8">
        <div className="relative z-10 min-w-0">
          <span className="friendly-pill border border-white/15 bg-white/10 text-white/80">Your account</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Settings</h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-white/75 sm:text-base">Keep your profile, alerts, and support options in one simple place.</p>
        </div>
        <Image src="/images/story/inbox.webp" alt="" width={220} height={184} priority className="relative z-10 h-auto w-full object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.22)]" />
        <div className="pointer-events-none absolute -bottom-14 -right-10 h-40 w-40 rounded-full bg-[#d8ffad]/10" />
      </header>

      <section aria-labelledby="account-settings-heading">
        <div className="mb-3 px-1 sm:mb-4">
          <h2 id="account-settings-heading" className="font-display text-lg font-extrabold text-slate-900 sm:text-xl">Account and help</h2>
          <p className="mt-1 text-sm text-slate-500">Choose what you want to manage.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {items.map(item => {
            const content = (
              <>
                <SettingIcon kind={item.icon} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-extrabold text-slate-900">{item.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{item.description}</span>
                </span>
                <span aria-hidden className="text-2xl font-light text-slate-400">›</span>
              </>
            )
            return item.external
              ? <a key={item.label} href={item.href} className="solid-3d-choice">{content}</a>
              : <Link key={item.label} href={item.href} className="solid-3d-choice">{content}</Link>
          })}
        </div>
      </section>

      {(user.role === 'artisan' || user.role === 'professional') && <TierSection role={user.role} />}

      <section className="solid-3d-card overflow-hidden p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="solid-3d-icon h-14 w-14 bg-[#f6c85f] text-[#5b430d]"><ShareIcon /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-extrabold text-slate-900">Share Anywork365</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">Help someone find a trusted artisan or professional.</p>
          </div>
        </div>
        <button type="button" onClick={() => void shareApp()} className="btn-primary mt-5 w-full justify-center sm:w-auto">Share the app</button>
      </section>

      {socialLinks.length > 0 && (
        <section className="solid-3d-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-extrabold text-slate-900">Follow Anywork365</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {socialLinks.map(([name, href]) => <a key={name} href={href} target="_blank" rel="noreferrer" className="segment">{name}</a>)}
          </div>
        </section>
      )}

      <button type="button" onClick={() => void logout()} className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 shadow-[0_3px_0_#fecaca] transition-transform active:translate-y-0.5 active:shadow-none sm:w-auto sm:min-w-40">Log out</button>
    </div>
  )
}

function TierSection({ role }: { role: 'artisan' | 'professional' }) {
  const [selectedTier, setSelectedTier] = useState<TierId>('gold')
  const selected = tierPlans.find(tier => tier.id === selectedTier) ?? tierPlans[0]
  const actionHref = role === 'artisan'
    ? '/dashboard/verify-business'
    : 'mailto:support@anywork365.ng?subject=Professional%20tier%20eligibility'

  return (
    <section aria-labelledby="tier-heading" className="overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,#0f4f4a_0%,#073b38_100%)] text-white shadow-[0_8px_0_#062d2a,0_22px_45px_rgba(7,59,56,0.2)]">
      <div className="px-4 pb-6 pt-6 sm:px-7 sm:pb-8 sm:pt-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="friendly-pill border border-white/15 bg-white/10 text-[#d8ffad]">Vendor and professional tiers</span>
          <h2 id="tier-heading" className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">Choose your path to greater visibility</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/70">Explore the requirements and benefits for each Anywork365 tier.</p>
        </div>

        <div className="mx-auto mt-6 grid max-w-2xl grid-cols-4 rounded-2xl bg-white/10 p-1.5 shadow-inner" role="tablist" aria-label="Membership tiers">
          {tierPlans.map(tier => (
            <button
              key={tier.id}
              type="button"
              role="tab"
              aria-selected={selectedTier === tier.id}
              aria-controls="selected-tier-panel"
              onClick={() => setSelectedTier(tier.id)}
              className={`min-h-11 rounded-xl px-1 text-[11px] font-extrabold transition sm:px-3 sm:text-sm ${selectedTier === tier.id ? 'bg-[#d8ffad] text-brand-900 shadow-[0_3px_0_#8bbd62]' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              {tier.name}
            </button>
          ))}
        </div>

        <div id="selected-tier-panel" role="tabpanel" className="relative mx-auto mt-5 max-w-2xl overflow-hidden rounded-[1.75rem] bg-white p-5 text-slate-900 shadow-[0_7px_0_rgba(0,0,0,0.14)] sm:p-7">
          <div className={`pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-gradient-to-br ${selected.tone} opacity-60 blur-sm`} />
          <div className="relative flex items-start gap-4">
            <div className={`solid-3d-icon h-16 w-16 flex-none bg-gradient-to-br ${selected.tone} text-brand-900 sm:h-20 sm:w-20`}>
              <TierIcon tier={selected.id} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">{selected.eyebrow}</p>
              <h3 className="mt-1 font-display text-xl font-black text-slate-950 sm:text-2xl">{selected.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selected.description}</p>
            </div>
          </div>

          <div className="relative mt-5 grid gap-2 sm:grid-cols-2">
            <TierDetail icon="reach" text={selected.coverage} />
            <TierDetail icon="star" text={selected.ratings} />
          </div>

          <div className="relative mt-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Requirements</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{selected.requirements}</p>
          </div>

          <ul className="relative mt-4 grid gap-2 sm:grid-cols-2">
            {selected.benefits.map(benefit => (
              <li key={benefit} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-100 text-brand-700">✓</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-6 flex max-w-2xl flex-col items-center text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">Annual subscription</p>
          <p className="mt-1 font-display text-3xl font-black text-white">
            {selected.price === 0 ? 'No annual fee' : `${formatNaira(selected.price)}/year`}
          </p>
          <p className="mt-2 max-w-lg text-xs leading-5 text-white/60">Eligibility, documentation, completed-task ratings, and verification are reviewed before a tier is granted.</p>
          {role === 'artisan'
            ? <Link href={actionHref} className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#d8ffad] px-6 text-base font-black text-brand-900 shadow-[0_5px_0_#8bbd62] transition active:translate-y-1 active:shadow-none sm:w-auto sm:min-w-64">Check eligibility</Link>
            : <a href={actionHref} className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#d8ffad] px-6 text-base font-black text-brand-900 shadow-[0_5px_0_#8bbd62] transition active:translate-y-1 active:shadow-none sm:w-auto sm:min-w-64">Check eligibility</a>}
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/15 px-4 py-5 sm:px-7">
        <p className="text-center text-xs font-extrabold uppercase tracking-[0.13em] text-white/60">Compare annual tiers</p>
        <div className="mx-auto mt-3 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
          {tierPlans.map(tier => (
            <button key={tier.id} type="button" onClick={() => setSelectedTier(tier.id)} className={`rounded-2xl border p-3 text-left transition ${selectedTier === tier.id ? 'border-[#d8ffad] bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
              <span className="block text-sm font-black text-white">{tier.name}</span>
              <span className="mt-1 block text-xs text-white/60">{tier.price === 0 ? 'Free' : `${formatNaira(tier.price)}/yr`}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount)
}

function TierDetail({ icon, text }: { icon: 'reach' | 'star'; text: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        {icon === 'reach'
          ? <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
          : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>}
      </span>
      <span className="text-xs font-bold leading-5 text-slate-600 sm:text-sm">{text}</span>
    </div>
  )
}

function TierIcon({ tier }: { tier: TierId }) {
  if (tier === 'default') return <Image src="/images/story/ready.webp" alt="" width={80} height={80} className="h-12 w-12 object-contain sm:h-16 sm:w-16" />
  return (
    <svg className="h-9 w-9 sm:h-11 sm:w-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 15 8l5.5 1-3.8 4.2.7 5.8-5.4-2.4L6.6 19l.7-5.8L3.5 9 9 8l3-5Z" fill="currentColor" fillOpacity=".18"/>
      <path d="M12 3 15 8l5.5 1-3.8 4.2.7 5.8-5.4-2.4L6.6 19l.7-5.8L3.5 9 9 8l3-5Z"/>
      <path d="m9.4 12 1.7 1.7 3.6-4"/>
    </svg>
  )
}

function SettingIcon({ kind }: { kind: SettingItem['icon'] }) {
  const tone = kind === 'profile'
    ? 'bg-brand-100 text-brand-700'
    : kind === 'notifications'
      ? 'bg-amber-100 text-amber-700'
      : kind === 'report'
        ? 'bg-violet-100 text-violet-700'
        : kind === 'verification'
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-sky-100 text-sky-700'

  return (
    <span className={`solid-3d-icon h-12 w-12 ${tone}`}>
      {kind === 'profile' ? <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg> : null}
      {kind === 'notifications' ? <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10 21h4"/></svg> : null}
      {kind === 'report' ? <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg> : null}
      {kind === 'verification' ? <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 12 2.5 2.5L16 9"/><path d="M12 2 15 5l4 .5.5 4 2.5 2.5-2.5 2.5-.5 4-4 .5-3 3-3-3-4-.5-.5-4L2 12l2.5-2.5.5-4L9 5l3-3Z"/></svg> : null}
      {kind === 'support' ? <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v5a2 2 0 0 0 2 2h2v-7H4ZM20 13v5a2 2 0 0 1-2 2h-2v-7h4Z"/></svg> : null}
    </span>
  )
}

function ShareIcon() {
  return <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg>
}
