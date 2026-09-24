'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { StoryArt } from '@/components/ui/StoryArt'
import Link from 'next/link'
import { JOB_CATEGORIES, NIGERIAN_STATE_NAMES } from '@/types'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { AppFooter } from '@/components/layout/AppFooter'
import type { AuthUser } from '@/types'

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className || 'w-5 h-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function HeroSection({ user, loading }: { user: AuthUser | null; loading: boolean }) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:py-20">
        <div>
          <p className="mb-4 text-sm font-bold text-brand-500">Good people. Great work.</p>
          <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.5rem]">A little help.<br />A world of possibility.</h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">Find the right hands for your next project, or put your skills to work.</p>
          <form action="/artisans" method="GET" className="mt-8 space-y-3">
            <label htmlFor="home-service" className="label">What can we help with?</label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input id="home-service" type="search" name="search" placeholder="Try plumbing, tailoring, painting…" className="input-field pl-12" />
            </div>
            <div className="flex gap-3">
              <select aria-label="State" name="state" className="input-field min-w-0 flex-1">
                <option value="">All states</option>
                {NIGERIAN_STATE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="submit" className="btn-primary shrink-0 px-6">Find an artisan</button>
            </div>
          </form>
          {!loading && !user && <p className="mt-6 text-sm text-slate-600">Here to offer your skills? <Link href="/signup" className="font-bold text-brand-500 underline underline-offset-4">Join Anywork365</Link></p>}
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-600 sm:text-sm">
            {['Local expertise', 'Clear quotes', 'Booking updates'].map(label => <span key={label} className="inline-flex items-center gap-2"><CheckIcon className="h-4 w-4 text-brand-500" />{label}</span>)}
          </div>
        </div>
        <div className="mx-auto w-full max-w-lg">
          <StoryArt kind="people" priority className="w-full" />
          <p className="mt-4 text-center text-sm text-slate-500">Different skills. One place to connect.</p>
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  const { user, loading } = useCurrentUser()
  const displayCategories = useMemo(() => JOB_CATEGORIES.slice(0, 12), [])

  return (
    <div className="bg-surface-base">
      <HeroSection user={user} loading={loading} />

      {/* Categories */}
      <section className="border-t border-slate-100 bg-white px-4 py-12 sm:px-6 sm:py-16 lg:px-8 content-below-fold">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Browse by category</h2>
            </div>
            <Link href="/artisans" className="text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">
              View all
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {displayCategories.map((service) => (
              <Link
                key={service}
                href={`/artisans?category=${encodeURIComponent(service)}`}
                className="group flex min-h-[164px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-[#fbfcf8] px-4 py-5 text-center transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:bg-[#f3f7ef] hover:shadow-card-md"
              >
                <CategoryIcon category={service} size={82} />
                <span className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-700 transition-colors group-hover:text-brand-600">{service}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-100 bg-white px-4 py-10 sm:px-6 sm:py-12 lg:px-8 content-below-fold">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">How booking works</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Search and compare',
                desc: 'Browse artisans by category, location and rating. Check profiles and reviews before choosing.',
                art: '/images/booking/search-compare.webp',
              },
              {
                step: '02',
                title: 'Book and pay',
                desc: 'Select your preferred professional, agree on terms, and pay for that booking through our protected marketplace flow.',
                art: '/images/booking/book-pay.webp',
              },
              {
                step: '03',
                title: 'Complete and review',
                desc: 'Get your job done, release payment when satisfied, and leave a review to help others.',
                art: '/images/booking/complete-review.webp',
              },
            ].map((item) => (
              <div key={item.step} className="card-sm flex min-h-[300px] flex-col items-center text-center">
                <Image src={item.art} alt="" width={384} height={320} sizes="(max-width: 639px) 144px, 160px" className="mb-1 h-32 w-40 object-contain sm:h-36" />
                <span className="text-xs font-bold text-slate-300 mb-2 tracking-widest">{item.step}</span>
                <h3 className="font-display font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - hidden when signed in */}
      {!user && (
        <section className="border-t border-brand-800 bg-brand-800 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 content-below-fold">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Create an account
            </h2>
            <p className="text-brand-100 text-lg mb-8 leading-relaxed">
              Book an artisan, offer your services, apply for jobs or recruit candidates.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="btn-outline px-8">
                Create account
              </Link>
              <Link href="/artisans" className="flex h-[52px] items-center justify-center rounded-full border border-white/30 px-8 text-sm font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.98]">
                Browse Artisans
              </Link>
            </div>
          </div>
        </section>
      )}
      <AppFooter />
    </div>
  )
}
