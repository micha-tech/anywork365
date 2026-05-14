'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { JOB_CATEGORIES, NIGERIAN_CITIES } from '@/types'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
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

function VerifiedBadge() {
  return (
    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </div>
  )
}

function HeroSection({ user, loading }: { user: AuthUser | null; loading: boolean }) {
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <section className="relative bg-white overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-50 rounded-full blur-3xl opacity-60 translate-y-1/2 -translate-x-1/4" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-100 border border-slate-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              <span className="text-xs font-semibold text-slate-500">Trusted by 10,000+ users across Nigeria</span>
            </div>

            <div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.1] tracking-tight text-slate-900">
                Connect with <span className="text-brand-500">trusted</span> professionals
              </h1>
            </div>

            <p className="text-lg text-slate-500 leading-relaxed max-w-md">
              Book verified artisans, technicians, and service providers near you. Secure payments. Guaranteed quality.
            </p>

            <form action="/professionals" method="GET" className="flex flex-col sm:flex-row gap-2.5">
              <div className={`relative flex-1 transition-all duration-200 ${searchFocused ? 'scale-[1.01]' : ''}`}>
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  name="search"
                  placeholder="What service do you need?"
                  className="w-full h-[52px] pl-12 pr-4 rounded-xl border-2 border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all text-sm"
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
              </div>
              <select
                name="city"
                className="h-[52px] px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-700 focus:border-brand-400 outline-none transition-all cursor-pointer text-sm font-medium"
              >
                <option value="">All cities</option>
                {NIGERIAN_CITIES.slice(0, 12).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                type="submit"
                className="h-[52px] px-7 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 active:scale-[0.98] transition-all shadow-sm hover:shadow-md whitespace-nowrap"
              >
                Search
              </button>
            </form>

            {!loading && !user && (
              <div className="flex gap-3">
                <Link href="/signup" className="h-[48px] px-6 rounded-xl bg-brand-500 text-white font-semibold text-sm flex items-center justify-center hover:bg-brand-600 active:scale-[0.98] transition-all">
                  Get Started Free
                </Link>
                <Link href="/login" className="h-[48px] px-6 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition-all">
                  Sign In
                </Link>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-6">
              {[
                { text: 'Verified Professionals' },
                { text: '4.9 Average Rating' },
                { text: 'Secure Escrow Payments' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="w-5 h-5 rounded-full bg-brand-50 flex items-center justify-center">
                    <CheckIcon className="w-3 h-3 text-brand-500" />
                  </div>
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[420px]">
              <div className="absolute inset-0 bg-brand-100 rounded-[2.5rem] blur-3xl opacity-50 scale-95" />

              <div className="relative z-10">
                <Image
                  src="/phone-hand.webp"
                  alt="Anywork365 mobile app"
                  width={480}
                  height={620}
                  priority
                  className="w-full h-auto object-contain"
                  style={{ filter: 'drop-shadow(0 20px 40px rgba(15,79,74,0.12))' }}
                />
              </div>

              <div className="absolute top-[18%] -left-3 sm:left-0 z-20 bg-white rounded-xl shadow-card-md p-3 flex items-center gap-3 border border-slate-100">
                <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">Job Completed</p>
                  <p className="text-[10px] text-slate-400">2 hours ago</p>
                </div>
              </div>

              <div className="absolute bottom-[28%] -right-2 sm:right-0 z-20 bg-white rounded-xl shadow-card-md p-3 border border-slate-100">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((s) => (
                    <svg key={s} className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.798 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.798-2.034a1 1 0 00-1.175 0l-2.798 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">4.9/5 from 2,000+ reviews</p>
              </div>

              <div className="absolute bottom-[8%] -left-3 sm:left-0 z-20 bg-white rounded-xl shadow-card-md p-3 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">500+ Vendors</p>
                    <p className="text-[10px] text-slate-400">Ready to help</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  const { user, loading } = useCurrentUser()
  const [vendors, setVendors] = useState<User[]>([])
  const [jobs, setJobs] = useState<Job[]>([])

  useEffect(() => {
    fetch('/api/professionals?limit=8')
      .then(r => r.json())
      .then(d => { if (d.success) setVendors(d.data) })
      .catch(() => {})
    fetch('/api/jobs?limit=3')
      .then(r => r.json())
      .then(d => { if (d.success) setJobs(d.data) })
      .catch(() => {})
  }, [])

  const featuredVendors = vendors.slice(0, 8)
  const latestJobs = jobs.slice(0, 3)
  const displayCategories = JOB_CATEGORIES.slice(0, 12)
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
      <section className="border-t border-slate-100 bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-1.5">Services</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Browse by category</h2>
            </div>
            <Link href="/professionals" className="text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">
              View all
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {displayCategories.map((service) => (
              <Link
                key={service}
                href={`/professionals?category=${encodeURIComponent(service)}`}
                className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-surface-100 p-4 text-center transition-all duration-200 hover:border-brand-300 hover:shadow-card-md hover:bg-white hover:-translate-y-0.5"
              >
                <CategoryIcon category={service} size={40} />
                <span className="text-xs font-semibold text-slate-700 line-clamp-2 mt-2 group-hover:text-brand-600 transition-colors">{service}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Vendors */}
      <section className="border-t border-slate-100 px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-1.5">Top Rated</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Featured Professionals</h2>
            </div>
            <Link href="/professionals" className="text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">
              View all
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredVendors.map((vendor) => (
              <Link
                key={vendor.id}
                href={`/professionals/${vendor.id}`}
                className="card group hover:border-brand-300 hover:shadow-card-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-brand-500 text-white font-bold text-base flex items-center justify-center">
                      {vendor.firstName[0]}{vendor.lastName[0]}
                    </div>
                    {vendor.isVerified && (
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <VerifiedBadge />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm leading-tight line-clamp-1">{vendor.firstName} {vendor.lastName}</h3>
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
                  <span className="px-2 py-0.5 rounded-full bg-surface-100 border border-slate-200 text-xs font-medium text-slate-600 line-clamp-1">
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
      <section className="border-t border-slate-100 bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">How it works</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Book in three simple steps</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Search & Compare',
                desc: 'Browse verified professionals by category, location, and rating. Read reviews from real clients.',
                icon: (
                  <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ),
              },
              {
                step: '02',
                title: 'Book & Pay Securely',
                desc: 'Select your preferred professional, agree on terms, and pay through our secure escrow system.',
                icon: (
                  <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                ),
              },
              {
                step: '03',
                title: 'Work & Review',
                desc: 'Get your job done, release payment when satisfied, and leave a review to help others.',
                icon: (
                  <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="card-sm flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mb-4">{item.icon}</div>
                <span className="text-xs font-bold text-slate-300 mb-2 tracking-widest">{item.step}</span>
                <h3 className="font-display font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Jobs */}
      {latestJobs.length > 0 && (
        <section className="border-t border-slate-100 px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-1.5">Careers</p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Latest Openings</h2>
              </div>
              <Link href="/jobs" className="text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">
                View all
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {latestJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="card hover:border-brand-300 hover:shadow-card-md transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${job.jobType === 'full-time' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                      {job.jobType === 'full-time' ? 'Full-time' : 'Contract'}
                    </span>
                    {job.closingDate && (
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        Closes {new Date(job.closingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 line-clamp-1 mb-1">{job.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-1 mb-3">{job.businessName}</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <LocationIcon className="w-3.5 h-3.5" />
                    <span className="line-clamp-1">{job.businessAddress}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-slate-100 bg-brand-500 px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Ready to get started?
          </h2>
          <p className="text-brand-100 text-lg mb-8 leading-relaxed">
            Join thousands of Nigerians who trust Anywork365 to connect them with quality professionals.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="h-[52px] px-8 rounded-xl bg-white text-brand-600 font-bold text-sm flex items-center justify-center hover:bg-brand-50 active:scale-[0.98] transition-all shadow-sm">
              Create Free Account
            </Link>
            <Link href="/professionals" className="h-[52px] px-8 rounded-xl border-2 border-white/30 text-white font-semibold text-sm flex items-center justify-center hover:bg-white/10 active:scale-[0.98] transition-all">
              Browse Professionals
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}