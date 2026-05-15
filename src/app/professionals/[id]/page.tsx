'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import { Avatar, Badge, Stars } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { getInitials } from '@/lib/utils'
import type { User } from '@/types'

export default function ProDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params)
  const router = useRouter()
  const [pro, setPro] = useState<User | null>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [bookOpen, setBookOpen] = useState(false)
  const [booked,   setBooked]   = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [calling, setCalling] = useState<'voice' | 'video' | null>(null)
  const [quickConnecting, setQuickConnecting] = useState(false)

  useEffect(() => {
    fetch(`/api/professionals/${id}`)
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

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!pro) return

    setBookingError('')
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
        setBookingError(data.error || 'Failed to create booking')
        setBookingLoading(false)
        return
      }

      setBookOpen(false)
      setBooked(true)
    } catch {
      setBookingError('Network error. Please try again.')
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
        alert(data.error || 'Failed to start chat')
      }
    } catch {
      alert('Failed to start chat. Please try again.')
    } finally {
      setStartingChat(false)
    }
  }

  function handleCall(type: 'voice' | 'video') {
    if (!pro?.phone) {
      alert('This vendor has not shared their phone number')
      return
    }
    setCalling(type)
    const phone = pro.phone
    
    setTimeout(() => {
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
        alert('Failed to initiate call. Please try again.')
      } finally {
        setCalling(null)
      }
    }, 300)
  }

  function handleQuickConnect() {
    if (!pro?.phone) {
      alert('This vendor has not shared their phone number')
      return
    }
    setQuickConnecting(true)
    const phone = pro.phone
    
    setTimeout(() => {
      try {
        const digits = phone.replace(/\D/g, '')
        const message = encodeURIComponent(`Hi ${pro.firstName}, I found your profile on Anywork365 and I'm interested in your services. Can we discuss?`)
        const url = `https://wa.me/${digits}?text=${message}`
        
        const whatsappWebUrl = `https://web.whatsapp.com/send?phone=${digits}&text=${message}`
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        
        const targetUrl = isMobile ? url : whatsappWebUrl
        
        window.open(targetUrl, '_blank', 'noopener,noreferrer')
      } catch {
        alert('Failed to open WhatsApp. Please try again.')
      } finally {
        setQuickConnecting(false)
      }
    }, 500)
  }

  const colorIndex = 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <Link href="/professionals" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-500 mb-5">
        ← Back to Vendors
      </Link>

      {booked && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-5 text-sm">
          ✅ Booking request sent! {pro.firstName} will respond shortly.
        </div>
      )}

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 z-50 pb-safe">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleCall('voice')}
              disabled={calling !== null}
              className="w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center disabled:opacity-50"
            >
              {calling === 'voice' ? (
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => handleCall('video')}
              disabled={calling !== null}
              className="w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center disabled:opacity-50"
            >
              {calling === 'video' ? (
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleQuickConnect}
              disabled={quickConnecting}
              className="w-11 h-11 rounded-full bg-green-500 text-white flex items-center justify-center disabled:opacity-50"
            >
              {quickConnecting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                </svg>
              )}
            </button>
          </div>
          <button
            onClick={() => setBookOpen(true)}
            disabled={booked}
            className="btn-primary px-5 py-2.5 flex-shrink-0"
          >
            {booked ? 'Requested \u2713' : 'Book Now'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-5">
          <div className="card">
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <Avatar initials={initials} size="lg" colorIndex={colorIndex} className="mb-4" />
                {pro.isVerified && (
                  <div className="absolute -bottom-2 left-8 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white bg-blue-500">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-lg sm:text-xl font-semibold">
                    {pro.firstName} {pro.lastName}
                  </h1>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{pro.skills?.[0]} · {pro.city}</p>
                {pro.rating && (
                  <div className="mt-2">
                    <Stars rating={pro.rating} count={pro.reviewCount} />
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {pro.skills?.map((skill) => (
                    <Badge key={skill} variant="green">{skill}</Badge>
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

          <div className="card">
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
              Hire {pro.firstName}
            </p>
            <div className="space-y-2 text-sm mb-5">
              {[
                { label: 'Location',     value: pro.city },
                { label: 'Rating',       value: `${pro.rating?.toFixed(1)} / 5.0` },
                { label: 'Reviews',      value: String(pro.reviewCount) },
                { label: 'Availability', value: 'Available now' },
              ].map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-slate-500">{r.label}</span>
                  <span className={`font-medium ${r.label === 'Availability' ? 'text-brand-500' : ''}`}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setBookOpen(true)}
              disabled={booked}
              className="btn-primary w-full py-3 justify-center"
            >
              {booked ? 'Requested \u2713' : `Book ${pro.firstName}`}
            </button>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => handleCall('voice')}
                disabled={calling !== null}
                className="btn-ghost py-2.5 justify-center flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {calling === 'voice' ? (
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
                  </svg>
                )}
                Call
              </button>
              <button
                onClick={() => handleCall('video')}
                disabled={calling !== null}
                className="btn-ghost py-2.5 justify-center flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {calling === 'video' ? (
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
                Video
              </button>
            </div>

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
              onClick={handleQuickConnect}
              disabled={quickConnecting}
              className="w-full py-2.5 justify-center mt-2 flex items-center gap-2 text-sm font-medium bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors disabled:opacity-70"
            >
              {quickConnecting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.627 0-12 5.373-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.837 2.795-7.26 8.072-7.26 4.236 0 7.531 3.021 7.531 7.061 0 4.206-2.647 7.575-6.326 7.575-1.351 0-2.612-.703-3.443-1.529-.138-.218-.16-.408-.116-.598l.115-.665c.069-.534.253-.946.549-1.277 1.618-1.811 3.305-3.373 4.596-4.178.391-.246.868-.377 1.318-.235.641.199 1.323.475 1.757.846.694.591 1.125 1.58 1.048 2.589-.105 1.375-1.106 2.462-2.043 2.462-.188 0-.361-.017-.535-.052.92 2.839 2.704 5.197 5.113 5.197 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Quick Connect (WhatsApp)
                </>
              )}
            </button>
          </div>

          {pro.isVerified && (
            <div className="card-sm bg-brand-50 border-brand-500/20">
              <p className="text-sm font-medium text-brand-500 mb-1">✓ Verified Vendor</p>
              <p className="text-xs text-brand-500/70">Identity and credentials verified by Anywork365</p>
            </div>
          )}
        </div>
      </div>

      <Modal open={bookOpen} onClose={() => { setBookOpen(false); setBookingError('') }} title={`Book ${pro.firstName} ${pro.lastName}`}>
        <form onSubmit={handleBook}>
          {bookingError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
              {bookingError}
            </div>
          )}
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
            <button type="button" onClick={() => { setBookOpen(false); setBookingError('') }} className="btn-ghost w-full sm:w-auto px-6 justify-center">Cancel</button>
            <button type="submit" disabled={bookingLoading} className="btn-primary w-full sm:w-auto px-8 justify-center">
              {bookingLoading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}