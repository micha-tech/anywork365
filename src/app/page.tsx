'use client'

import { useState, useEffect, useMemo } from 'react'
import { StoryArt } from '@/components/ui/StoryArt'
import Link from 'next/link'
import { JOB_CATEGORIES, NIGERIAN_STATE_NAMES } from '@/types'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { VerifiedBusinessBadge } from '@/components/ui'
import { AppFooter } from '@/components/layout/AppFooter'
import { SkeletonProCard, SkeletonJobCard } from '@/components/ui/Skeleton'
import { JobCard } from '@/components/forms/JobCard'
import type { User, Job, AuthUser } from '@/types'

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function StarIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className || 'w-4 h-4'} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.798 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.798-2.034a1 1 0 00-1.175 0l-2.798 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
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

function LocationIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function HeartIcon({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
  return (
    <svg className={className || 'w-5 h-5'} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
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
  const [vendors, setVendors] = useState<User[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [vendorsLoading, setVendorsLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/artisans?limit=8')
      .then(r => r.json())
      .then(d => { if (d.success) setVendors(d.data) })
      .catch(() => console.error('Failed to load vendors'))
      .finally(() => setVendorsLoading(false))
    fetch('/api/jobs?limit=3')
      .then(r => r.json())
      .then(d => { if (d.success) setJobs(d.data) })
      .catch(() => console.error('Failed to load jobs'))
      .finally(() => setJobsLoading(false))
  }, [])

  const featuredVendors = useMemo(() => vendors.slice(0, 8), [vendors])
  const latestJobs = useMemo(() => jobs.slice(0, 3), [jobs])
  const displayCategories = useMemo(() => JOB_CATEGORIES.slice(0, 12), [])
  const [favorites, setFavorites] = useState<string[]>([])

  function toggleFavorite(e: React.MouseEvent, vendorId: string) {
    e.preventDefault()
    setFavorites(prev =>
      prev.includes(vendorId)
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    )
  }

  

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

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {displayCategories.map((service) => (
              <Link
                key={service}
                href={`/artisans?category=${encodeURIComponent(service)}`}
                className="group flex min-h-[132px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-[#fbfcf8] p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:bg-[#efffde] hover:shadow-card-md"
              >
                <CategoryIcon category={service} size={40} />
                <span className="text-xs font-semibold text-slate-700 line-clamp-2 mt-2 group-hover:text-brand-600 transition-colors">{service}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Vendors */}
      <section className="border-t border-slate-100 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 content-below-fold">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Artisans</h2>
            </div>
            <Link href="/artisans" className="text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">
              View all
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {vendorsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonProCard key={i} />)
            ) : featuredVendors.length === 0 ? (
              <p className="col-span-full text-sm text-slate-500 text-center py-8">No artisans found</p>
            ) : featuredVendors.map((vendor) => (
              <Link
                key={vendor.id}
                href={`/artisans/${vendor.id}`}
                  className="card group hover:border-brand-300 hover:shadow-card-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-base font-bold text-white">
                      {vendor.firstName[0]}{vendor.lastName[0]}
                    </div>
                    {vendor.isVerified && (
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <VerifiedBusinessBadge label={false} size="sm" className="ring-2 ring-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-slate-900 text-sm leading-tight line-clamp-1">{vendor.firstName} {vendor.lastName}</h3>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                      <LocationIcon className="w-3 h-3" />
                      <span className="line-clamp-1">{vendor.city}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => toggleFavorite(e, vendor.id)}
                    className="p-1 rounded-full hover:bg-slate-100 transition-colors self-start"
                  >
                    <HeartIcon filled={favorites.includes(vendor.id)} className={`w-4 h-4 ${favorites.includes(vendor.id) ? 'text-red-500' : 'text-slate-300'}`} />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                    <span className="line-clamp-1 rounded-full border border-slate-200 bg-surface-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {vendor.skills?.[0]}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <StarIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-sm font-semibold text-slate-800">{Math.round(vendor.rating || 4.5)}</span>
                    <span className="text-xs text-slate-400">({vendor.reviewCount || 0})</span>
                  </div>
                  <span className="text-xs font-medium text-slate-400">View profile</span>
                </div>
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
                icon: (
                  <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ),
              },
              {
                step: '02',
                title: 'Book and pay',
                desc: 'Select your preferred professional, agree on terms, and pay for that booking through our protected marketplace flow.',
                icon: (
                  <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                ),
              },
              {
                step: '03',
                title: 'Complete and review',
                desc: 'Get your job done, release payment when satisfied, and leave a review to help others.',
                icon: (
                  <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="card-sm flex flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#efffde]">{item.icon}</div>
                <span className="text-xs font-bold text-slate-300 mb-2 tracking-widest">{item.step}</span>
                <h3 className="font-display font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Jobs */}
      {(jobsLoading || latestJobs.length > 0) && (
        <section className="border-t border-slate-100 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 content-below-fold">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Latest jobs</h2>
              </div>
              <Link href="/jobs" className="text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">
                View all
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobsLoading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonJobCard key={i} />)
              ) : latestJobs.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
          </div>
        </section>
      )}

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
