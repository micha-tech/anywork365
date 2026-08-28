'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Modal } from '@/components/ui/Modal'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/EmptyState'
import { startChatConversation } from '@/lib/chat-client'

interface BookingQuote {
  id: number
  amount: number
  scope: string
  estimatedDuration: string | null
  proposedStartDate: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'superseded' | 'withdrawn'
  rejectionReason: 'price' | 'scope' | 'timeline' | 'materials' | 'inspection' | 'other' | null
  rejectionNote: string | null
  createdAt: string
}

interface BookingPayment {
  reference: string
  amount: number
  bankName: string
  bankSlug: string | null
  accountName: string
  accountNumber: string
  status: 'active' | 'paid' | 'expired' | 'cancelled' | 'rejected' | 'failed'
  expiresAt: string
}

interface BookingItem {
  id: number
  businessId: number
  clientUID: string
  businessName?: string
  clientName?: string
  description: string
  budget: number
  priceConfirmed: number
  date: string
  location: string
  inspectionMethod: 'none' | 'physical' | 'virtual'
  status: 'pending' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled'
  createdAt: string
  quotes: BookingQuote[]
  payment: BookingPayment | null
  reasonForCancellation?: string
  refundStatus?: 'not_required' | 'pending' | 'processing' | 'completed' | 'failed'
}

const BOOKING_STEPS = [
  { status: 'pending', label: 'Requested', detail: 'Awaiting quote' },
  { status: 'confirmed', label: 'Confirmed', detail: 'Quote accepted' },
  { status: 'completed', label: 'Completed', detail: 'Payment released' },
] as const

type BookingFilter = 'active' | 'pending' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled' | 'all'

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function BookingTimeline({ status }: { status: BookingItem['status'] }) {
  if (status === 'cancelled') {
    return (
      <div className="mt-4 grid grid-cols-[minmax(0,auto)_1fr_minmax(0,auto)] items-center gap-2 sm:gap-3" aria-label="Booking cancelled">
        <div className="flex min-w-0 flex-col items-center text-center">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white sm:h-7 sm:w-7 sm:text-xs">1</span>
          <span className="mt-1 text-[11px] font-medium leading-tight text-slate-700 sm:text-xs">Requested</span>
        </div>
        <div className="h-0.5 bg-red-200" />
        <div className="flex min-w-0 flex-col items-center text-center">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white sm:h-7 sm:w-7"><XIcon /></span>
          <span className="mt-1 text-[11px] font-medium leading-tight text-red-600 sm:text-xs">Cancelled</span>
        </div>
      </div>
    )
  }

  const activeIndex = status === 'completed' ? 2 : status === 'confirmed' ? 1 : 0
  return (
    <div className="mt-4 grid grid-cols-[minmax(0,auto)_1fr_minmax(0,auto)_1fr_minmax(0,auto)] items-start" aria-label={`Booking ${status}`}>
      {BOOKING_STEPS.map((step, index) => (
        <div key={step.status} className="contents">
          <div className="flex min-w-0 flex-col items-center text-center">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold sm:h-7 sm:w-7 sm:text-xs ${
              index <= activeIndex ? 'bg-brand-500 text-white' : 'border border-slate-300 bg-white text-slate-400'
            }`}>
              {index < activeIndex ? <CheckIcon /> : index + 1}
            </span>
            <span className={`mt-1 max-w-[4.5rem] text-[11px] font-medium leading-tight sm:text-xs ${index <= activeIndex ? 'text-slate-800' : 'text-slate-400'}`}>
              {step.label}
            </span>
            <span className="hidden text-[11px] text-slate-400 sm:block">{step.detail}</span>
          </div>
          {index < BOOKING_STEPS.length - 1 && (
            <div className={`mt-3.5 h-0.5 ${index < activeIndex ? 'bg-brand-500' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function BookingsPage() {
  const router = useRouter()
  const { user, loading } = useCurrentUser()
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<BookingFilter>('active')

  const [quoteBooking, setQuoteBooking] = useState<BookingItem | null>(null)
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteScope, setQuoteScope] = useState('')
  const [quoteDuration, setQuoteDuration] = useState('')
  const [quoteStartDate, setQuoteStartDate] = useState('')
  const [quoteSubmitting, setQuoteSubmitting] = useState(false)

  const [rejectionBooking, setRejectionBooking] = useState<{ booking: BookingItem; quote: BookingQuote } | null>(null)
  const [rejectionReason, setRejectionReason] = useState<BookingQuote['rejectionReason']>('price')
  const [rejectionNote, setRejectionNote] = useState('')
  const [rejectionSubmitting, setRejectionSubmitting] = useState(false)

  const [paymentBooking, setPaymentBooking] = useState<BookingItem | null>(null)
  const [paymentDetails, setPaymentDetails] = useState<BookingPayment | null>(null)
  const [paymentSubmitting, setPaymentSubmitting] = useState<'wallet' | 'bank_transfer' | null>(null)
  const [paymentNow, setPaymentNow] = useState(() => Date.now())

  const [cancellationBooking, setCancellationBooking] = useState<BookingItem | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancellationSubmitting, setCancellationSubmitting] = useState(false)

  const [reviewBooking, setReviewBooking] = useState<BookingItem | null>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  async function loadBookings(): Promise<void> {
    setFetching(true)
    try {
      const response = await fetch('/api/bookings', { cache: 'no-store' })
      const result = await response.json()
      if (response.ok && result.success) setBookings(result.data)
      else toast.error('Couldn\u2019t load bookings')
    } catch {
      toast.error('Couldn\u2019t load bookings')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    if (!loading && user) loadBookings()
    if (!loading && !user) setFetching(false)
  }, [user, loading])

  useEffect(() => {
    if (!loading && user?.role === 'artisan') setStatusFilter('pending')
  }, [loading, user?.role])

  const activePaymentBookingId = paymentBooking?.id
  const activePaymentReference = paymentDetails?.reference

  useEffect(() => {
    if (!activePaymentBookingId || !activePaymentReference) return

    const tick = window.setInterval(() => setPaymentNow(Date.now()), 1000)
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch('/api/bookings', { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok || !result.success) return
        const latestBookings = result.data as BookingItem[]
        setBookings(latestBookings)
        const latest = latestBookings.find((booking) => booking.id === activePaymentBookingId)
        if (latest?.status === 'confirmed') {
          setPaymentBooking(null)
          setPaymentDetails(null)
          toast.success('Payment confirmed')
        } else if (latest?.status === 'cancelled') {
          setPaymentBooking(null)
          setPaymentDetails(null)
        } else if (latest?.payment?.status === 'active') {
          setPaymentDetails(latest.payment)
        }
      } catch {
        // The next poll or a manual check will retry without interrupting the client.
      }
    }, 10000)

    return () => {
      window.clearInterval(tick)
      window.clearInterval(poll)
    }
  }, [activePaymentBookingId, activePaymentReference])

  async function handleAction(bookingId: number, action: string, reason?: string) {
    const actionKey = `${bookingId}:${action}`
    setActionLoading(actionKey)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || 'Action completed')
        loadBookings()
      } else {
        toast.error(data.error || 'Action failed')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  function openQuoteComposer(booking: BookingItem) {
    const currentQuote = booking.quotes?.find((quote) => quote.status === 'pending') ?? booking.quotes?.[0]
    setQuoteBooking(booking)
    setQuoteAmount(String(currentQuote?.amount || booking.budget || ''))
    setQuoteScope(currentQuote?.scope || booking.description || '')
    setQuoteDuration(currentQuote?.estimatedDuration || '')
    setQuoteStartDate(currentQuote?.proposedStartDate?.slice(0, 10) || booking.date || '')
  }

  async function handleSendQuote(e: React.FormEvent) {
    e.preventDefault()
    if (!quoteBooking) return

    setQuoteSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${quoteBooking.id}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(quoteAmount),
          scope: quoteScope,
          estimatedDuration: quoteDuration || null,
          proposedStartDate: quoteStartDate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Couldn\u2019t send the quote')
        return
      }
      toast.success(data.message || 'Quote sent to the client')
      setQuoteBooking(null)
      loadBookings()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setQuoteSubmitting(false)
    }
  }

  async function handleQuoteDecision(booking: BookingItem, quote: BookingQuote, action: 'accept' | 'reject') {
    if (action === 'reject') {
      setRejectionBooking({ booking, quote })
      setRejectionReason('price')
      setRejectionNote('')
      return
    }

    const actionKey = `${booking.id}:quote:${action}`
    setActionLoading(actionKey)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/quotes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.id, action }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Couldn\u2019t update the quote')
        return
      }
      toast.success(data.message || 'Quote accepted')
      setPaymentBooking({ ...booking, budget: quote.amount, priceConfirmed: 1, status: 'awaiting_payment' })
      setPaymentDetails(null)
      loadBookings()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRequestChanges(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectionBooking || !rejectionReason || rejectionNote.trim().length < 5) return
    setRejectionSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${rejectionBooking.booking.id}/quotes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: rejectionBooking.quote.id,
          action: 'reject',
          rejectionReason,
          rejectionNote: rejectionNote.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Couldn\u2019t send your feedback')
        return
      }
      toast.success(data.message || 'Changes requested')
      setRejectionBooking(null)
      loadBookings()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setRejectionSubmitting(false)
    }
  }

  function openPayment(booking: BookingItem) {
    setPaymentBooking(booking)
    setPaymentDetails(booking.payment?.status === 'active' ? booking.payment : null)
    setPaymentNow(Date.now())
  }

  async function checkPaymentStatus(showFeedback: boolean) {
    if (!paymentBooking) return
    try {
      if (showFeedback && paymentDetails) {
        const verificationResponse = await fetch(`/api/bookings/${paymentBooking.id}/payment`, {
          cache: 'no-store',
        })
        const verification = await verificationResponse.json()
        if (!verificationResponse.ok && verificationResponse.status !== 202) {
          throw new Error(verification.error || 'Payment verification failed')
        }
        if (verification.data?.status === 'confirmed') {
          setPaymentBooking(null)
          setPaymentDetails(null)
          await loadBookings()
          toast.success('Payment confirmed')
          return
        }
        if (verification.data?.status === 'rejected') {
          setPaymentDetails(null)
          toast.error(verification.message)
          return
        }
      }

      const response = await fetch('/api/bookings', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error('Booking refresh failed')

      const latestBookings = result.data as BookingItem[]
      setBookings(latestBookings)
      const latest = latestBookings.find((booking) => booking.id === paymentBooking.id)
      if (latest?.status === 'confirmed') {
        setPaymentBooking(null)
        setPaymentDetails(null)
        toast.success('Payment confirmed')
        return
      }
      if (latest?.status === 'cancelled') {
        setPaymentBooking(null)
        setPaymentDetails(null)
        toast.error('This booking is no longer active.')
        return
      }
      if (latest?.payment?.status === 'active') setPaymentDetails(latest.payment)
      if (showFeedback) toast.info('Payment not received yet')
    } catch {
      if (showFeedback) toast.error('Couldn\u2019t check payment. Try again.')
    }
  }

  async function handlePayment(method: 'wallet' | 'bank_transfer') {
    if (!paymentBooking) return
    setPaymentSubmitting(method)
    try {
      const res = await fetch(`/api/bookings/${paymentBooking.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        if (res.status === 402) {
          toast.error(data.error || 'Your wallet balance is too low.', {
            action: { label: 'Add money', onClick: () => router.push('/wallet?tab=fund') },
          })
        } else {
          toast.error(data.error || 'Couldn\u2019t start payment')
        }
        return
      }
      if (data.data?.method === 'bank_transfer') {
        setPaymentDetails({
          reference: data.data.reference,
          amount: data.data.amount,
          bankName: data.data.bankName,
          bankSlug: data.data.bankSlug || null,
          accountName: data.data.accountName,
          accountNumber: data.data.accountNumber,
          status: 'active',
          expiresAt: data.data.expiresAt,
        })
        setPaymentNow(Date.now())
        toast.success('Account ready')
      } else {
        toast.success('Payment confirmed')
        setPaymentBooking(null)
      }
      loadBookings()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setPaymentSubmitting(null)
    }
  }

  const paymentSecondsRemaining = paymentDetails
    ? Math.max(0, Math.floor((new Date(paymentDetails.expiresAt).getTime() - paymentNow) / 1000))
    : 0
  const paymentCountdown = `${Math.floor(paymentSecondsRemaining / 60)}:${String(paymentSecondsRemaining % 60).padStart(2, '0')}`

  function openCancellation(booking: BookingItem) {
    setCancellationBooking(booking)
    setCancellationReason('')
  }

  async function handleCancellation(e: React.FormEvent) {
    e.preventDefault()
    if (!cancellationBooking || cancellationReason.trim().length < 5) return
    setCancellationSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${cancellationBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: cancellationReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Couldn\u2019t cancel this booking')
        return
      }
      toast.success(data.message || 'Booking cancelled')
      setCancellationBooking(null)
      loadBookings()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setCancellationSubmitting(false)
    }
  }

  async function handleMessageClient(clientUID: string) {
    if (!clientUID) {
      router.push('/messages')
      return
    }

    setActionLoading(`message:${clientUID}`)
    try {
      const conversation = await startChatConversation(clientUID)
      router.push(`/messages?id=${conversation.id}`)
    } catch {
      router.push('/messages')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSubmitReview() {
    if (!reviewBooking || reviewRating === 0 || !reviewComment.trim()) return
    setReviewSubmitting(true)

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: reviewBooking.id,
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to submit review')
        return
      }
      setReviewBooking(null)
      setReviewRating(0)
      setReviewComment('')
      toast.success('Review submitted')
      loadBookings()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  function openReview(b: BookingItem) {
    setReviewBooking(b)
    setReviewRating(0)
    setReviewComment('')
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    awaiting_payment: 'bg-violet-100 text-violet-800',
    confirmed: 'bg-brand-100 text-brand-700',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-slate-100 text-slate-600',
  }
  const statusAccents: Record<string, string> = {
    pending: 'bg-amber-400',
    awaiting_payment: 'bg-violet-400',
    confirmed: 'bg-brand-400',
    completed: 'bg-emerald-400',
    cancelled: 'bg-slate-300',
  }

  const isVendor = user?.role === 'artisan'
  const activeBookings = bookings.filter((booking) => ['pending', 'awaiting_payment', 'confirmed'].includes(booking.status))
  const visibleBookings = statusFilter === 'all'
    ? bookings
    : statusFilter === 'active'
      ? activeBookings
      : bookings.filter((booking) => booking.status === statusFilter)
  const bookingTabs: Array<{ key: BookingFilter; label: string; count: number }> = [
    { key: 'active', label: 'Active', count: activeBookings.length },
    { key: 'pending', label: isVendor ? 'New requests' : 'Pending', count: bookings.filter((booking) => booking.status === 'pending').length },
    { key: 'awaiting_payment', label: 'Awaiting payment', count: bookings.filter((booking) => booking.status === 'awaiting_payment').length },
    { key: 'confirmed', label: 'Accepted', count: bookings.filter((booking) => booking.status === 'confirmed').length },
    { key: 'completed', label: 'Completed', count: bookings.filter((booking) => booking.status === 'completed').length },
    { key: 'cancelled', label: 'Cancelled', count: bookings.filter((booking) => booking.status === 'cancelled').length },
    { key: 'all', label: 'All', count: bookings.length },
  ]

  return (
    <>
      <PullToRefresh onRefresh={loadBookings}>
      <div className="mb-5 sm:mb-7">
        <div className="friendly-hero p-5 sm:p-7">
          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <span className="friendly-pill mb-3 bg-white/10 text-[#d8ffad] ring-1 ring-inset ring-white/10">
                <SparkIcon /> {activeBookings.length} active
              </span>
              <h1 className="font-display text-2xl font-bold tracking-[-0.04em] sm:text-4xl">
                {isVendor ? 'Your work, all in one place' : 'Keep every job moving'}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
                {isVendor ? 'Review requests, share quotes and stay on top of every job.' : 'Compare quotes, pay securely and follow each booking.'}
              </p>
            </div>
            <div className="hidden h-20 w-20 items-center justify-center rounded-[2rem] bg-[#c9f58b] text-brand-900 shadow-lg sm:flex">
              <BookingsHeroIcon />
            </div>
          </div>
        </div>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">
          {bookingTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`flex-shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm ${
                statusFilter === tab.key
                  ? 'border-brand-700 bg-brand-700 text-white shadow-[0_6px_16px_rgba(15,79,74,0.16)]'
                  : 'border-slate-200 bg-white text-slate-500 hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        {fetching ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : visibleBookings.length === 0 ? (
          <EmptyState
            icon="bookings"
            title={bookings.length === 0 ? 'No bookings yet' : 'Nothing here'}
            description={bookings.length === 0
              ? (isVendor ? 'Client bookings will appear here.' : 'Book an artisan to start tracking work.')
              : 'Try another status tab.'}
            action={!isVendor && bookings.length === 0 ? (
              <Link
                href="/artisans"
                className="inline-flex w-fit rounded-md border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100"
              >
                Find artisan
              </Link>
            ) : undefined}
          />
        ) : visibleBookings.map((b) => {
          const latestQuote = b.quotes?.[0]
          const pendingQuote = b.quotes?.find((quote) => quote.status === 'pending')
          const inspectionLabel = b.inspectionMethod === 'physical'
            ? 'Physical inspection'
            : b.inspectionMethod === 'virtual'
              ? 'Virtual inspection'
              : 'No inspection needed'

          return (
          <div key={b.id} className="friendly-card relative min-w-0 overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,79,74,0.09)] sm:p-6">
            <div className={`absolute inset-x-0 top-0 h-1.5 ${statusAccents[b.status] || 'bg-slate-300'}`} />
            <div className="flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
              <div className="flex-1 min-w-0">
                <p className="mb-2 flex flex-wrap items-center gap-1.5 break-words text-xs font-medium text-slate-500 sm:text-sm">
                  <span className="text-slate-800">{isVendor ? (b.clientName || 'Client') : (b.businessName || 'Artisan')}</span>
                  <span className="text-slate-300">•</span>
                  <span>#{b.id}</span>
                  <span className="text-slate-300">•</span>
                  <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                </p>
                <p className="mb-3 break-words text-base font-semibold leading-snug text-slate-950 sm:text-lg">{b.description}</p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1.5"><strong className="text-slate-900">₦{b.budget?.toLocaleString()}</strong> {b.priceConfirmed ? 'agreed' : 'budget'}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1.5">{b.date}</span>
                  {b.location && <span className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1.5">{b.location}</span>}
                  <span className="rounded-full bg-brand-50 px-2.5 py-1.5 font-medium text-brand-700">{inspectionLabel}</span>
                </div>
              </div>
              <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusColors[b.status] || 'bg-gray-100 text-gray-600'}`}>
                {b.status.replace('_', ' ')}
              </span>
            </div>

            <BookingTimeline status={b.status} />

            {latestQuote && (
              <div className="relative mt-5 overflow-hidden rounded-2xl border border-brand-100 bg-[linear-gradient(135deg,#f5fbfa_0%,#ffffff_65%)] p-4 sm:p-5">
                <div className="absolute -right-5 -top-6 h-20 w-20 rounded-full bg-[#c9f58b]/25" />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-600"><QuoteIcon /> Artisan quote</p>
                    <p className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950">₦{latestQuote.amount.toLocaleString()}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                    latestQuote.status === 'accepted'
                      ? 'bg-green-100 text-green-700'
                      : latestQuote.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : latestQuote.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                  }`}>
                    {latestQuote.status}
                  </span>
                </div>
                <p className="relative mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{latestQuote.scope}</p>
                {(latestQuote.estimatedDuration || latestQuote.proposedStartDate) && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-brand-100 pt-2.5 text-xs text-slate-500">
                    {latestQuote.estimatedDuration && <span>Estimated duration: <strong className="text-slate-700">{latestQuote.estimatedDuration}</strong></span>}
                    {latestQuote.proposedStartDate && <span>Proposed start: <strong className="text-slate-700">{new Date(latestQuote.proposedStartDate).toLocaleDateString()}</strong></span>}
                  </div>
                )}
                {latestQuote.status === 'rejected' && latestQuote.rejectionNote && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold capitalize text-amber-800">
                      Changes requested{latestQuote.rejectionReason ? ` · ${latestQuote.rejectionReason}` : ''}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-amber-800">{latestQuote.rejectionNote}</p>
                  </div>
                )}
              </div>
            )}

            {b.status === 'awaiting_payment' && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-3.5 sm:p-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><PaymentIcon /></div>
                <div>
                <p className="text-sm font-semibold text-violet-950">
                  {isVendor ? 'Awaiting client payment' : 'Payment required'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-violet-700">
                  {isVendor
                    ? 'We\u2019ll notify you when it\u2019s confirmed.'
                    : b.payment?.status === 'active'
                      ? `${b.payment.bankName} account ready.`
                      : 'Choose how you want to pay.'}
                </p>
                </div>
              </div>
            )}

            {b.status === 'cancelled' && b.reasonForCancellation && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-600">
                <strong className="text-slate-800">Cancellation reason:</strong> {b.reasonForCancellation}
                {b.refundStatus && b.refundStatus !== 'not_required' && (
                  <p className="mt-1 text-xs capitalize text-slate-500">Refund: {b.refundStatus.replace('_', ' ')}</p>
                )}
              </div>
            )}

            {(b.status === 'pending' || b.status === 'awaiting_payment' || b.status === 'confirmed') && (
              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:flex">
                {isVendor && b.status === 'pending' && (
                  <button
                    onClick={() => openQuoteComposer(b)}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:opacity-50"
                  >
                    {pendingQuote ? 'Update quote' : latestQuote?.status === 'rejected' ? 'Send revised quote' : 'Send quote'}
                  </button>
                )}
                {isVendor && (
                  <button
                    type="button"
                    onClick={() => handleMessageClient(b.clientUID)}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    {actionLoading === `message:${b.clientUID}` ? 'Opening...' : 'Message client'}
                  </button>
                )}
                {!isVendor && b.status === 'confirmed' && (
                  <button
                    onClick={() => handleAction(b.id, 'complete')}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:opacity-50"
                  >
                    {actionLoading === `${b.id}:complete` ? 'Completing...' : 'Mark Complete'}
                  </button>
                )}
                {!isVendor && b.status === 'awaiting_payment' && (
                  <button
                    type="button"
                    onClick={() => openPayment(b)}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:opacity-50"
                  >
                    {b.payment?.status === 'active' ? 'View account' : 'Pay now'}
                  </button>
                )}
                {!isVendor && b.status === 'pending' && pendingQuote && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleQuoteDecision(b, pendingQuote, 'accept')}
                      disabled={actionLoading !== null}
                      className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:opacity-50"
                    >
                      {actionLoading === `${b.id}:quote:accept` ? 'Accepting...' : 'Accept quote'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuoteDecision(b, pendingQuote, 'reject')}
                      disabled={actionLoading !== null}
                      className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      Request changes
                    </button>
                  </>
                )}
                {['pending', 'awaiting_payment', 'confirmed'].includes(b.status) && (
                  <button
                    onClick={() => openCancellation(b)}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                  >
                    Cancel booking
                  </button>
                )}
              </div>
            )}
            {!isVendor && b.status === 'completed' && (
              <div className="mt-4 flex gap-2 border-t border-slate-200 pt-3">
                <button
                  onClick={() => openReview(b)}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-600"
                >
                  Leave a Review
                </button>
              </div>
            )}
          </div>
          )
        })}
      </div>

      <Modal
        open={rejectionBooking !== null}
        onClose={() => !rejectionSubmitting && setRejectionBooking(null)}
        title="Request quote changes"
      >
        {rejectionBooking && (
          <form onSubmit={handleRequestChanges}>
            <p className="mb-5 text-sm leading-relaxed text-slate-600">
              Tell the artisan exactly what should change so they can prepare a better quote.
            </p>
            <div className="form-group">
              <label className="label">What should be changed?</label>
              <select
                className="input-field"
                value={rejectionReason || 'price'}
                onChange={(event) => setRejectionReason(event.target.value as BookingQuote['rejectionReason'])}
              >
                <option value="price">Price</option>
                <option value="scope">Scope of work</option>
                <option value="timeline">Timeline</option>
                <option value="materials">Materials</option>
                <option value="inspection">Inspection</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">What would you like the artisan to revise?</label>
              <textarea
                required
                minLength={5}
                maxLength={1000}
                rows={4}
                className="input-field resize-y"
                value={rejectionNote}
                onChange={(event) => setRejectionNote(event.target.value)}
                placeholder="For example: Please separate the labour and material costs and propose a lower-cost material option."
              />
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" className="btn-ghost px-5 py-2.5 text-sm" onClick={() => setRejectionBooking(null)} disabled={rejectionSubmitting}>
                Keep quote
              </button>
              <button type="submit" className="btn-primary px-5 py-2.5 text-sm" disabled={rejectionSubmitting || rejectionNote.trim().length < 5}>
                {rejectionSubmitting ? 'Sending...' : 'Send feedback'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={paymentBooking !== null}
        onClose={() => paymentSubmitting === null && setPaymentBooking(null)}
        title="Choose how to pay"
      >
        {paymentBooking && (
          <div>
            <div className="relative mb-5 overflow-hidden rounded-3xl border border-brand-100 bg-[#efffde] p-5">
              <div className="absolute -right-4 -top-8 h-24 w-24 rounded-full bg-[#c9f58b]" />
              <div className="relative flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-brand-700">
                <span>Amount due</span>
                <span>Booking #{paymentBooking.id}</span>
              </div>
              <p className="relative mt-2 font-display text-3xl font-bold tracking-tight text-brand-900">₦{paymentBooking.budget.toLocaleString()}</p>
            </div>

            {paymentDetails ? (
              <div>
                <div className="relative overflow-hidden rounded-3xl border border-brand-700 bg-brand-800 p-5 text-white shadow-[0_18px_40px_rgba(4,31,30,0.18)]">
                  <div className="absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-brand-400/15" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#d8ffad]"><BankIcon /> Transfer details</p>
                      <p className="mt-2 text-sm font-medium text-white/75">{paymentDetails.bankName}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentSecondsRemaining > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {paymentSecondsRemaining > 0 ? 'Waiting for payment' : 'Expired'}
                    </span>
                  </div>
                  <p className="relative mt-5 font-mono text-3xl font-bold tracking-wider text-white">{paymentDetails.accountNumber}</p>
                  <p className="relative mt-1 text-sm text-white/65">{paymentDetails.accountName}</p>
                  <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
                    <div>
                      <p className="text-white/50">Exact amount</p>
                      <p className="mt-0.5 font-semibold text-white">₦{paymentDetails.amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-white/50">Time remaining</p>
                      <p className={`mt-0.5 font-semibold ${paymentSecondsRemaining > 0 ? 'text-white' : 'text-red-300'}`}>
                        {paymentSecondsRemaining > 0 ? paymentCountdown : 'Expired'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs leading-relaxed text-slate-600">
                  <p>Send the exact amount to the account above.</p>
                  <p className="mt-1">We\u2019ll confirm your booking once payment is received.</p>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {paymentSecondsRemaining === 0 ? (
                    <button
                      type="button"
                      className="btn-primary justify-center py-2.5 text-sm sm:col-span-2"
                      onClick={() => handlePayment('bank_transfer')}
                      disabled={paymentSubmitting !== null}
                    >
                      {paymentSubmitting === 'bank_transfer' ? 'Getting account...' : 'Get a new account'}
                    </button>
                  ) : (
                    <>
                  <button
                    type="button"
                    className="btn-primary justify-center py-2.5 text-sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(paymentDetails.accountNumber)
                      toast.success('Account number copied')
                    }}
                  >
                    Copy account number
                  </button>
                  <button
                    type="button"
                    className="btn-ghost justify-center py-2.5 text-sm"
                    onClick={() => void checkPaymentStatus(true)}
                  >
                    Check payment
                  </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handlePayment('wallet')}
                  disabled={paymentSubmitting !== null}
                  className="friendly-choice group disabled:opacity-50"
                >
                  <span className="friendly-icon bg-[#efffde] text-brand-700"><WalletChoiceIcon /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-950">Anywork365 balance</span>
                    <span className="mt-0.5 block text-xs text-slate-500">Pay instantly from your available balance.</span>
                    {paymentSubmitting === 'wallet' && <span className="mt-1 block text-xs font-semibold text-brand-600">Paying...</span>}
                  </span>
                  <ArrowIcon />
                </button>
                <button
                  type="button"
                  onClick={() => handlePayment('bank_transfer')}
                  disabled={paymentSubmitting !== null}
                  className="friendly-choice group disabled:opacity-50"
                >
                  <span className="friendly-icon bg-amber-50 text-amber-700"><BankIcon /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-950">Bank transfer</span>
                    <span className="mt-0.5 block text-xs text-slate-500">Pay directly from your banking app.</span>
                    {paymentSubmitting === 'bank_transfer' && <span className="mt-1 block text-xs font-semibold text-brand-600">Getting account...</span>}
                  </span>
                  <ArrowIcon />
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={cancellationBooking !== null}
        onClose={() => !cancellationSubmitting && setCancellationBooking(null)}
        title="Cancel booking"
      >
        {cancellationBooking && (
          <form onSubmit={handleCancellation}>
            <p className="text-sm leading-relaxed text-slate-600">
              {cancellationBooking.status === 'confirmed'
                ? 'Your payment will be refunded after cancellation.'
                : 'This booking will be cancelled immediately.'}
            </p>
            <div className="form-group mt-5">
              <label className="label">Reason for cancellation</label>
              <textarea
                required
                minLength={5}
                maxLength={500}
                rows={4}
                className="input-field resize-y"
                value={cancellationReason}
                onChange={(event) => setCancellationReason(event.target.value)}
                placeholder="Explain briefly so the other person understands why the booking is being cancelled."
              />
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" className="btn-ghost px-5 py-2.5 text-sm" onClick={() => setCancellationBooking(null)} disabled={cancellationSubmitting}>
                Keep booking
              </button>
              <button type="submit" className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50" disabled={cancellationSubmitting || cancellationReason.trim().length < 5}>
                {cancellationSubmitting ? 'Cancelling...' : 'Cancel booking'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={quoteBooking !== null} onClose={() => !quoteSubmitting && setQuoteBooking(null)} title="Build your quote">
        {quoteBooking && (
          <form onSubmit={handleSendQuote}>
            <div className="relative mb-5 overflow-hidden rounded-3xl border border-brand-100 bg-[linear-gradient(135deg,#efffde_0%,#ffffff_75%)] p-4 sm:p-5">
              <div className="absolute -right-5 -top-8 h-24 w-24 rounded-full bg-[#c9f58b]/35" />
              <p className="relative flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-700"><QuoteIcon /> Request #{quoteBooking.id}</p>
              <p className="relative mt-2 text-sm font-medium leading-6 text-slate-800">{quoteBooking.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Client budget: <strong className="text-slate-700">₦{quoteBooking.budget.toLocaleString()}</strong></span>
                <span>
                  Inspection: <strong className="text-slate-700">
                    {quoteBooking.inspectionMethod === 'physical'
                      ? 'Physical'
                      : quoteBooking.inspectionMethod === 'virtual'
                        ? 'Virtual'
                        : 'Not required'}
                  </strong>
                </span>
              </div>
            </div>

            {quoteBooking.quotes?.[0]?.status === 'rejected' && quoteBooking.quotes[0].rejectionNote && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">What the client wants changed</p>
                <p className="mt-1 text-sm font-medium capitalize text-amber-900">{quoteBooking.quotes[0].rejectionReason}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-amber-800">{quoteBooking.quotes[0].rejectionNote}</p>
              </div>
            )}

            <div className="form-group">
              <label className="label">Your price (₦)</label>
              <input
                type="number"
                inputMode="numeric"
                min={1000}
                max={10000000}
                required
                className="input-field rounded-2xl text-lg font-bold"
                value={quoteAmount}
                onChange={(event) => setQuoteAmount(event.target.value)}
                placeholder="50000"
              />
              <p className="mt-1 text-xs text-slate-500">The client pays only after accepting your quote.</p>
            </div>

            <div className="form-group">
              <label className="label">What the quote covers</label>
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                className="input-field resize-y rounded-2xl"
                value={quoteScope}
                onChange={(event) => setQuoteScope(event.target.value)}
                placeholder="Describe the work, labour, materials, and anything that is not included."
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="form-group min-w-0">
                <label className="label">Estimated duration</label>
                <input
                  type="text"
                  maxLength={120}
                  className="input-field rounded-2xl"
                  value={quoteDuration}
                  onChange={(event) => setQuoteDuration(event.target.value)}
                  placeholder="e.g. 2–3 days"
                />
              </div>
              <div className="form-group min-w-0">
                <label className="label">Proposed start date</label>
                <input
                  type="date"
                  className="input-field rounded-2xl"
                  min={new Date().toISOString().split('T')[0]}
                  value={quoteStartDate}
                  onChange={(event) => setQuoteStartDate(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setQuoteBooking(null)}
                disabled={quoteSubmitting}
                className="btn-ghost rounded-full px-5 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={quoteSubmitting || !quoteAmount || quoteScope.trim().length < 10}
                className="btn-primary rounded-full px-5 py-2.5 text-sm"
              >
                {quoteSubmitting ? 'Sending...' : 'Send quote'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={reviewBooking !== null} onClose={() => setReviewBooking(null)} title="Leave a Review">
        {reviewBooking && (
          <div>
            <p className="text-sm text-slate-500 mb-4">
              Rate your experience with <strong>{reviewBooking.businessName || 'this artisan'}</strong>
            </p>

            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors ${
                    star <= reviewRating
                      ? 'bg-amber-100 text-amber-500'
                      : 'bg-gray-50 text-gray-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            <div className="form-group mb-4">
              <label className="label">Your Review</label>
              <textarea
                className="input-field resize-y"
                rows={4}
                placeholder="Describe your experience..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setReviewBooking(null)}
                className="btn-ghost px-6 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={reviewSubmitting || reviewRating === 0 || !reviewComment.trim()}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      </PullToRefresh>
    </>
  )
}

function SparkIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" />
      <path strokeLinecap="round" d="M19 15v4M21 17h-4" />
    </svg>
  )
}

function BookingsHeroIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 14 2 2 4-4" />
    </svg>
  )
}

function QuoteIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path strokeLinecap="round" d="M9 8h6M9 12h4" />
    </svg>
  )
}

function PaymentIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
      <path strokeLinecap="round" d="M4 9h16m-4 5h1" />
    </svg>
  )
}

function BankIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 9 9-5 9 5M5 10h14M6 10v7m4-7v7m4-7v7m4-7v7M4 17h16M3 20h18" />
    </svg>
  )
}

function WalletChoiceIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11h5v4h-5a2 2 0 1 1 0-4Z" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg className="h-5 w-5 flex-shrink-0 text-slate-300 transition-colors group-hover:text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
    </svg>
  )
}

