'use client'

import { use, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar, Badge, Stars, VerifiedBusinessBadge } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, getInitials } from '@/lib/utils'
import type { User } from '@/types'

export default function ProDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
  if (loading || !pro) return <div className="max-w-4xl mx-auto px-4 py-10"><div className="animate-pulse h-40 bg-gray-100 rounded-2xl" /></div>

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
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to create booking')
        setBookingLoading(false)
        return
      }

      setBookOpen(false)
      setBooked(true)
      toast.success('Booking request sent!')
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
    <div className="max-w-4xl mx-auto px-3 pb-40 pt-4 sm:px-6 sm:py-10">
      <Link href="/artisans" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-500 mb-5">
        ← Back to Artisans
      </Link>

      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur pb-safe">
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

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-5">
          <div className="card p-4 sm:p-6">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="relative flex-shrink-0">
                <Avatar src={pro.avatarUrl} initials={initials} size="lg" colorIndex={colorIndex} className="mb-4 h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg" />
                {pro.isVerified && (
                  <VerifiedBusinessBadge label={false} className="absolute -bottom-2 left-8 border-2 border-white shadow-sm" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="min-w-0 break-words font-display text-lg font-semibold leading-snug sm:text-xl">
                    {displayName}
                  </h1>
                  {pro.isVerified && <VerifiedBusinessBadge size="sm" />}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {[pro.businessName ? ownerName : null, pro.skills?.[0], pro.city].filter(Boolean).join(' · ')}
                </p>
                {pro.rating && (
                  <div className="mt-2">
                    <Stars rating={pro.rating} count={pro.reviewCount} />
                  </div>
                )}
                <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
                  {pro.skills?.map((skill) => (
                    <Badge key={skill} variant="green" className="max-w-full truncate">{skill}</Badge>
                  ))}
                </div>
              </div>
            </div>

            {pro.bio && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h2 className="font-medium text-sm mb-2">About</h2>
                <p className="text-sm text-slate-500 leading-relaxed">{pro.bio}</p>
              </div>
            )}
          </div>

          {pro.portfolio && pro.portfolio.length > 0 && (
            <section className="card p-4 sm:p-6">
              <h2 className="font-medium text-base mb-4">Portfolio</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pro.portfolio.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      width={640}
                      height={480}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-slate-900">{item.title}</h3>
                      {item.description && (
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="card p-4 sm:p-6">
            <h2 className="font-medium text-base mb-4">
              Reviews{' '}
              <span className="text-slate-500 font-normal text-sm">({pro.reviewCount})</span>
            </h2>
            <div className="divide-y divide-slate-200">
              {reviews.length > 0 ? reviews.map((r: any, i: number) => (
                <div key={i} className="py-4">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="text-sm font-medium">{r.review}</span>
                    <span className="text-xs text-slate-500">{r.dateAdded || ''}</span>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500 py-4">No reviews yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="hidden sm:flex flex-col gap-5">
          <div className="card">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-4">
              Hire {displayName}
            </p>
            <div className="space-y-2 text-sm mb-5">
              {[
                { label: 'Location', value: [pro.lga, pro.city].filter(Boolean).join(', ') },
                ...(pro.yearsOfExperience !== undefined
                  ? [{ label: 'Experience', value: `${pro.yearsOfExperience} year${pro.yearsOfExperience === 1 ? '' : 's'}` }]
                  : []),
                ...(pro.feePerHour
                  ? [{ label: 'Hourly rate', value: `${formatCurrency(pro.feePerHour)} / hour` }]
                  : []),
                { label: 'Rating', value: pro.rating !== undefined ? `${pro.rating.toFixed(1)} / 5.0` : 'Not rated' },
                { label: 'Reviews', value: String(pro.reviewCount ?? 0) },
              ].map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-slate-500">{r.label}</span>
                  <span className="font-medium text-right">{r.value}</span>
                </div>
              ))}
            </div>
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
          </div>

          {pro.isVerified && (
            <div className="card-sm border-green-200 bg-green-50">
              <div className="mb-2">
                <VerifiedBusinessBadge />
              </div>
              <p className="text-xs text-green-700">Identity and business credentials verified by Anywork365</p>
            </div>
          )}
        </div>
      </div>

      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title={`Book ${displayName}`}>
        <form onSubmit={handleBook}>
          <div className="form-group">
            <label className="label">Describe your job *</label>
            <textarea
              name="description"
              className="input-field resize-y"
              rows={4}
              required
              placeholder="What do you need done? Include location, materials, and any specific requirements..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Your Budget (₦)</label>
              <input name="budget" type="number" inputMode="numeric" className="input-field" min={1000} placeholder="50000" required />
            </div>
            <div className="form-group">
              <label className="label">Preferred Date</label>
              <input name="date" type="date" className="input-field" min={new Date().toISOString().split('T')[0]} required />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Your Location</label>
            <input name="location" type="text" className="input-field" placeholder="e.g. Lekki Phase 1, Lagos" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-end mt-6">
            <button type="button" onClick={() => setBookOpen(false)} className="btn-ghost w-full sm:w-auto px-6 justify-center">Cancel</button>
            <button type="submit" disabled={bookingLoading} className="btn-primary w-full sm:w-auto px-8 justify-center">
              {bookingLoading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
