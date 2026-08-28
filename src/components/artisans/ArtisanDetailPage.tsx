'use client'

import { use, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar, Badge, Stars, VerifiedBusinessBadge } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { getInitials } from '@/lib/utils'
import type { User } from '@/types'

export default function ArtisanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params)
  const router = useRouter()
  const [pro, setPro] = useState<User | null>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [bookOpen, setBookOpen] = useState(false)
  const [booked, setBooked] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [calling, setCalling] = useState<'voice' | 'video' | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])
  const [quickConnecting, setQuickConnecting] = useState(false)
  const [showContactOptions, setShowContactOptions] = useState(false)

  useEffect(() => {
    fetch(`/api/artisans/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPro(d.data.vendor)
          setReviews(d.data.reviews)
        }
      })
      .catch(() => console.error('Failed to load professional', id))
      .finally(() => setLoading(false))
  }, [id])

  if (!loading && !pro) notFound()
  if (loading || !pro) return <div className="mx-auto max-w-6xl px-4 py-10"><div className="h-40 animate-pulse bg-slate-100" /></div>

  const initials    = getInitials(pro.firstName, pro.lastName)
  const ownerName = `${pro.firstName} ${pro.lastName}`.trim()
  const displayName = pro.businessName || ownerName

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!pro) return

    setBookingLoading(true)
    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: pro.id,
          description: formData.get('description'),
          budget: parseInt(formData.get('budget') as string, 10),
          date: formData.get('date'),
          location: formData.get('location'),
          inspectionMethod: formData.get('inspectionMethod'),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to create booking request')
        setBookingLoading(false)
        return
      }

      setBookOpen(false)
      setBooked(true)
      toast.success('Request sent — watch for the artisan’s quote.')
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setBookingLoading(false)
    }
  }

  async function handleStartChat() {
    if (!pro) return
    setStartingChat(true)
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pro.id }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/messages?id=${data.data.conversation.id}`)
      } else {
        toast.error(data.error || 'Failed to start chat')
      }
    } catch {
      toast.error('Failed to start chat')
    } finally {
      setStartingChat(false)
    }
  }

  function handleCall(type: 'voice' | 'video') {
    if (!pro?.phone) {
      toast.error('This artisan hasn\u2019t shared their phone number')
      return
    }
    setCalling(type)
    const phone = pro.phone
    
    timerRef.current = setTimeout(() => {
      try {
        const digits = phone.replace(/\D/g, '')
        let url: string
        
        if (type === 'video') {
          const message = encodeURIComponent(`Hi ${pro.firstName}, I'd like a video call`)
          url = `https://wa.me/${digits}?text=${message}`
        } else {
          url = `tel:${phone}`
        }
        
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch {
        toast.error('Failed to initiate call')
      } finally {
        setCalling(null)
      }
    }, 300)
  }

  function handleQuickConnect() {
    if (!pro?.phone) {
      toast.error('This artisan hasn\u2019t shared their phone number')
      return
    }
    setQuickConnecting(true)
    const phone = pro.phone
    
    timerRef.current = setTimeout(() => {
      try {
        const digits = phone.replace(/\D/g, '')
        const message = encodeURIComponent(`Hi ${pro.firstName}, I found your profile on Anywork365 and I'm interested in your services. Can we discuss?`)
        const url = `https://wa.me/${digits}?text=${message}`
        
        const whatsappWebUrl = `https://web.whatsapp.com/send?phone=${digits}&text=${message}`
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        
        const targetUrl = isMobile ? url : whatsappWebUrl
        
        window.open(targetUrl, '_blank', 'noopener,noreferrer')
      } catch {
        toast.error('Failed to open WhatsApp')
      } finally {
        setQuickConnecting(false)
      }
    }, 500)
  }

  const colorIndex = 0

  return (
    <main className="mx-auto max-w-6xl bg-white px-4 pb-40 pt-6 sm:px-6 sm:pt-10 lg:pb-16">
      <Link href="/artisans" className="mb-7 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600">
        ← Back to artisans
      </Link>

      <div className="mobile-nav-offset fixed left-0 right-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-safe shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <button
            onClick={handleStartChat}
            disabled={startingChat}
            className="btn-ghost min-w-0 flex-1 px-3 py-2.5 justify-center"
          >
            {startingChat ? (
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              'Message'
            )}
          </button>
          <button
            onClick={() => setBookOpen(true)}
            disabled={booked}
            className="btn-primary min-w-0 flex-[1.35] px-3 py-2.5"
          >
            {booked ? 'Requested' : 'Request booking'}
          </button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
        <div className="min-w-0">
          <header className="border-b border-slate-200 pb-8">
            <div className="flex min-w-0 items-start gap-4 sm:gap-5">
              <div className="relative flex-shrink-0">
                <Avatar src={pro.avatarUrl} initials={initials} size="xl" colorIndex={colorIndex} className="h-20 w-20 text-2xl sm:h-24 sm:w-24" />
                {pro.isVerified && (
                  <VerifiedBusinessBadge label={false} className="absolute bottom-0 right-0 border-2 border-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <h1 className="min-w-0 break-words font-display text-2xl font-bold leading-tight text-slate-950 sm:text-4xl">
                    {displayName}
                  </h1>
                </div>
                <p className="mt-2 text-sm text-slate-600 sm:text-base">
                  {[pro.businessName ? ownerName : null, pro.skills?.[0], pro.city].filter(Boolean).join(' · ')}
                </p>
                {Number(pro.reviewCount || 0) > 0 && pro.rating !== undefined && (
                  <div className="mt-2">
                    <Stars rating={pro.rating} count={pro.reviewCount} />
                  </div>
                )}
                <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                  {pro.skills?.map((skill) => (
                    <Badge key={skill} variant="green" className="max-w-full truncate">{skill}</Badge>
                  ))}
                </div>
              </div>
            </div>

          </header>

          <section className="border-b border-slate-200 py-8 sm:py-10">
            <h2 className="font-display text-xl font-semibold text-slate-950">About</h2>
            <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-600 sm:text-base">
              {pro.bio || `${displayName} provides ${pro.skills?.[0]?.toLowerCase() || 'artisan services'} in ${pro.city || 'Nigeria'}.`}
            </p>
          </section>

          {pro.portfolio && pro.portfolio.length > 0 && (
            <section className="border-b border-slate-200 py-8 sm:py-10">
              <h2 className="font-display text-xl font-semibold text-slate-950">Portfolio</h2>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pro.portfolio.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200">
                    {item.imageUrl && (
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        width={640}
                        height={480}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    )}
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-slate-900">{item.title}</h3>
                      {item.description && (
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
                      )}
                      {item.projectUrl && (
                        <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-semibold text-brand-600">
                          View project →
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="py-8 sm:py-10">
            <h2 className="font-display text-xl font-semibold text-slate-950">
              Reviews{' '}
              <span className="text-slate-500 font-normal text-sm">({pro.reviewCount})</span>
            </h2>
            <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
              {reviews.length > 0 ? reviews.map((r: any, i: number) => (
                <div key={i} className="py-4">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="text-sm font-medium">{r.review}</span>
                    <span className="text-xs text-slate-500">{r.dateAdded || ''}</span>
                  </div>
                </div>
              )) : (
                <p className="py-5 text-sm text-slate-500">No reviews yet.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-lg border border-slate-200 bg-slate-50/60 p-5">
            <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Hire {displayName}
            </p>
            <dl className="mb-6 space-y-4 text-sm">
              {[
                { label: 'Location', value: [pro.lga, pro.city].filter(Boolean).join(', ') },
                ...(pro.yearsOfExperience !== undefined
                  ? [{ label: 'Experience', value: `${pro.yearsOfExperience} year${pro.yearsOfExperience === 1 ? '' : 's'}` }]
                  : []),
                { label: 'Rating', value: Number(pro.reviewCount || 0) > 0 && pro.rating !== undefined ? `${pro.rating.toFixed(1)} / 5.0` : 'Not rated' },
                { label: 'Reviews', value: String(pro.reviewCount ?? 0) },
              ].map((r) => (
                <div key={r.label}>
                  <dt className="text-xs text-slate-500">{r.label}</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">{r.value || 'Not provided'}</dd>
                </div>
              ))}
            </dl>
            <button
              onClick={() => setBookOpen(true)}
              disabled={booked}
              className="btn-primary w-full py-3 justify-center"
            >
              {booked ? 'Request sent' : `Request booking`}
            </button>

            <button
              onClick={handleStartChat}
              disabled={startingChat}
              className="btn-ghost w-full py-2.5 justify-center mt-2 flex items-center gap-2"
            >
              {startingChat ? (
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Send Message
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowContactOptions((value) => !value)}
              className="mt-2 w-full rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              {showContactOptions ? 'Hide contact options' : 'More contact options'}
            </button>

            {showContactOptions && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => handleCall('voice')}
                  disabled={calling !== null}
                  className="btn-ghost py-2.5 justify-center flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  {calling === 'voice' ? (
                    <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  ) : 'Call'}
                </button>
                <button
                  onClick={() => handleCall('video')}
                  disabled={calling !== null}
                  className="btn-ghost py-2.5 justify-center flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  {calling === 'video' ? (
                    <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  ) : 'Video'}
                </button>
                <button
                  onClick={handleQuickConnect}
                  disabled={quickConnecting}
                  className="col-span-2 w-full rounded-lg bg-green-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-70"
                >
                  {quickConnecting ? 'Opening...' : 'WhatsApp'}
                </button>
              </div>
            )}
            {pro.isVerified && (
              <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-600">Identity and business credentials verified by Anywork365.</p>
            )}
          </div>
        </aside>
      </div>

      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title={`Tell ${displayName} what you need`}>
        <form onSubmit={handleBook} className="min-w-0">
          <div className="mb-5 flex items-start gap-3 rounded-2xl bg-[#efffde] p-4">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#c9f58b] text-brand-900">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 14 2 2 4-4" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-brand-900">Start with the job basics</p>
              <p className="mt-0.5 text-xs leading-5 text-brand-700">You’ll receive a quote to review before making any payment.</p>
            </div>
          </div>
          <div className="form-group">
            <label className="label">What needs to be done?</label>
            <textarea
              name="description"
              className="input-field resize-y rounded-2xl"
              rows={4}
              required
              placeholder="Describe the job, materials, and anything the artisan should know."
            />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="form-group min-w-0">
              <label className="label">Your budget (₦)</label>
              <input name="budget" type="number" inputMode="numeric" className="input-field min-w-0 max-w-full rounded-2xl" min={1000} placeholder="50,000" required />
              <p className="mt-1 text-xs leading-relaxed text-slate-500">This is a guide only. You will not be charged when you send the request.</p>
            </div>
            <div className="form-group min-w-0">
              <label className="label">Preferred date</label>
              <input name="date" type="date" className="input-field min-w-0 max-w-full rounded-2xl" min={new Date().toISOString().split('T')[0]} required />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Job location</label>
            <input name="location" type="text" className="input-field rounded-2xl" placeholder="e.g. Lekki Phase 1, Lagos" />
          </div>
          <div className="form-group">
            <label className="label">How should the artisan inspect the job?</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { value: 'none', label: 'No inspection', hint: 'Quote from details' },
                { value: 'physical', label: 'In person', hint: 'Visit the location' },
                { value: 'virtual', label: 'Video call', hint: 'Inspect remotely' },
              ].map((option) => (
                <label key={option.value} className="cursor-pointer">
                  <input className="peer sr-only" type="radio" name="inspectionMethod" value={option.value} defaultChecked={option.value === 'none'} />
                  <span className="block rounded-2xl border border-slate-200 bg-white p-3 transition-all hover:border-brand-200 peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:ring-2 peer-checked:ring-brand-500/10">
                    <span className="block text-sm font-bold text-slate-900 peer-checked:text-brand-700">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex items-center gap-2 border-t border-slate-200 bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <button
              type="button"
              onClick={() => setBookOpen(false)}
              className="inline-flex h-11 flex-none items-center justify-center rounded-full px-3.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200 sm:px-5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bookingLoading}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-full bg-brand-500 px-4 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(15,79,74,0.16)] transition-all hover:-translate-y-0.5 hover:bg-brand-600 active:scale-[0.98] active:bg-brand-700 disabled:pointer-events-none disabled:opacity-50 sm:flex-none sm:px-6"
            >
              {bookingLoading ? 'Sending...' : 'Send booking request'}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  )
}
