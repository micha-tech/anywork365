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
          toast.success('Payment verified. Your booking is confirmed.')
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
          toast.success('Payment verified. Your booking is confirmed.')
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
        toast.success('Payment verified. Your booking is confirmed.')
        return
      }
      if (latest?.status === 'cancelled') {
        setPaymentBooking(null)
        setPaymentDetails(null)
        toast.error('This booking is no longer awaiting payment.')
        return
      }
      if (latest?.payment?.status === 'active') setPaymentDetails(latest.payment)
      if (showFeedback) toast.info('We are still waiting for the bank to verify this transfer.')
    } catch {
      if (showFeedback) toast.error('We couldn\u2019t check the payment yet. Please try again shortly.')
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
          toast.error(data.error || 'Your available credit is too low.', {
            action: { label: 'Add credit', onClick: () => router.push('/wallet?tab=fund') },
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
        toast.success('Temporary account created')
      } else {
        toast.success(data.message || 'Payment secured')
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
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: clientUID }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/messages?id=${data.data.conversation.id}`)
      } else {
        router.push('/messages')
      }
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
    pending: 'bg-amber-100 text-amber-700',
    awaiting_payment: 'bg-violet-100 text-violet-700',
    confirmed: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-slate-100 text-slate-600',
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
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-semibold">{isVendor ? 'Booking Requests' : 'Bookings'}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isVendor ? 'Review requests, send clear quotes, and track confirmed jobs.' : 'Review quotes, confirm work, and track every booking.'}
            </p>
          </div>
        </div>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">
          {bookingTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`flex-shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                statusFilter === tab.key
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-600'
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
          <div key={b.id} className="card min-w-0 p-4 sm:p-6">
            <div className="flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
              <div className="flex-1 min-w-0">
                <p className="mb-1 break-words text-xs text-slate-500 sm:text-sm">
                  {isVendor ? (b.clientName || 'Client') : (b.businessName || 'Artisan')} &middot; Booking #{b.id} &middot; {new Date(b.createdAt).toLocaleDateString()}
                </p>
                <p className="mb-2 break-words text-sm font-medium leading-snug">{b.description}</p>
                <div className="grid gap-1 text-xs text-slate-500 sm:flex sm:flex-wrap sm:gap-x-4">
                  <span>{b.priceConfirmed ? 'Agreed price' : 'Estimated budget'}: <strong className="text-slate-900">₦{b.budget?.toLocaleString()}</strong></span>
                  <span>Date: {b.date}</span>
                  {b.location && <span className="break-words">Location: {b.location}</span>}
                  <span className="font-medium text-brand-600">Inspection: {inspectionLabel}</span>
                </div>
              </div>
              <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[b.status] || 'bg-gray-100 text-gray-600'}`}>
                {b.status.replace('_', ' ')}
              </span>
            </div>

            <BookingTimeline status={b.status} />

            {latestQuote && (
              <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-3.5 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Artisan quote</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">₦{latestQuote.amount.toLocaleString()}</p>
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
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{latestQuote.scope}</p>
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
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3.5 sm:p-4">
                <p className="text-sm font-semibold text-violet-900">
                  {isVendor ? 'Waiting for the client to complete payment' : 'Complete payment to confirm this booking'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-violet-700">
                  {isVendor
                    ? 'You will be notified as soon as the payment is verified and secured.'
                    : b.payment?.status === 'active'
                      ? `A temporary ${b.payment.bankName} account is ready for this payment.`
                      : 'Choose available credit or generate a temporary bank account.'}
                </p>
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
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 sm:flex">
                {isVendor && b.status === 'pending' && (
                  <button
                    onClick={() => openQuoteComposer(b)}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                  >
                    {pendingQuote ? 'Update quote' : latestQuote?.status === 'rejected' ? 'Send revised quote' : 'Send quote'}
                  </button>
                )}
                {isVendor && (
                  <button
                    type="button"
                    onClick={() => handleMessageClient(b.clientUID)}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    {actionLoading === `message:${b.clientUID}` ? 'Opening...' : 'Message client'}
                  </button>
                )}
                {!isVendor && b.status === 'confirmed' && (
                  <button
                    onClick={() => handleAction(b.id, 'complete')}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                  >
                    {actionLoading === `${b.id}:complete` ? 'Completing...' : 'Mark Complete'}
                  </button>
                )}
                {!isVendor && b.status === 'awaiting_payment' && (
                  <button
                    type="button"
                    onClick={() => openPayment(b)}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                  >
                    {b.payment?.status === 'active' ? 'View payment details' : 'Complete payment'}
                  </button>
                )}
                {!isVendor && b.status === 'pending' && pendingQuote && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleQuoteDecision(b, pendingQuote, 'accept')}
                      disabled={actionLoading !== null}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                    >
                      {actionLoading === `${b.id}:quote:accept` ? 'Accepting...' : 'Accept quote'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuoteDecision(b, pendingQuote, 'reject')}
                      disabled={actionLoading !== null}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      Request changes
                    </button>
                  </>
                )}
                {['pending', 'awaiting_payment', 'confirmed'].includes(b.status) && (
                  <button
                    onClick={() => openCancellation(b)}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
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
                  className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
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
        title="Complete payment"
      >
        {paymentBooking && (
          <div>
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booking #{paymentBooking.id}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">₦{paymentBooking.budget.toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">Payment is recorded against this booking and secured only after verification.</p>
            </div>

            {paymentDetails ? (
              <div>
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Temporary transfer account</p>
                      <p className="mt-2 text-sm font-medium text-slate-800">{paymentDetails.bankName}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentSecondsRemaining > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {paymentSecondsRemaining > 0 ? 'Awaiting payment' : 'Account expired'}
                    </span>
                  </div>
                  <p className="mt-4 font-mono text-3xl font-semibold tracking-wider text-slate-950">{paymentDetails.accountNumber}</p>
                  <p className="mt-1 text-sm text-slate-600">{paymentDetails.accountName}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-brand-100 pt-3 text-xs">
                    <div>
                      <p className="text-slate-500">Exact amount</p>
                      <p className="mt-0.5 font-semibold text-slate-900">₦{paymentDetails.amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Time remaining</p>
                      <p className={`mt-0.5 font-semibold ${paymentSecondsRemaining > 0 ? 'text-slate-900' : 'text-red-600'}`}>
                        {paymentSecondsRemaining > 0 ? paymentCountdown : 'Expired'}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-amber-700">
                  Transfer the exact amount. The booking confirms automatically after Paystack verifies the payment—no receipt upload is required.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {paymentSecondsRemaining === 0 ? (
                    <button
                      type="button"
                      className="btn-primary justify-center py-2.5 text-sm sm:col-span-2"
                      onClick={() => handlePayment('bank_transfer')}
                      disabled={paymentSubmitting !== null}
                    >
                      {paymentSubmitting === 'bank_transfer' ? 'Generating account...' : 'Generate a new account'}
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
                    I have paid
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
                  className="w-full rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                >
                  <span className="block text-sm font-semibold text-slate-900">Use available credit</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">Secure the payment immediately from your verified ledger credit.</span>
                  {paymentSubmitting === 'wallet' && <span className="mt-2 block text-xs font-semibold text-brand-600">Securing payment...</span>}
                </button>
                <button
                  type="button"
                  onClick={() => handlePayment('bank_transfer')}
                  disabled={paymentSubmitting !== null}
                  className="w-full rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                >
                  <span className="block text-sm font-semibold text-slate-900">Pay by bank transfer</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">Generate a temporary Paystack account for this quote only.</span>
                  {paymentSubmitting === 'bank_transfer' && <span className="mt-2 block text-xs font-semibold text-brand-600">Generating account...</span>}
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
                ? 'This booking has a secured payment. Cancelling it will start the appropriate refund process.'
                : 'No payment has been secured, so this booking can be cancelled immediately.'}
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

      <Modal open={quoteBooking !== null} onClose={() => !quoteSubmitting && setQuoteBooking(null)} title="Send a quote">
        {quoteBooking && (
          <form onSubmit={handleSendQuote}>
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booking request #{quoteBooking.id}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{quoteBooking.description}</p>
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
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Client feedback</p>
                <p className="mt-1 text-sm font-medium capitalize text-amber-900">{quoteBooking.quotes[0].rejectionReason}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-amber-800">{quoteBooking.quotes[0].rejectionNote}</p>
              </div>
            )}

            <div className="form-group">
              <label className="label">Quote amount (₦)</label>
              <input
                type="number"
                inputMode="numeric"
                min={1000}
                max={10000000}
                required
                className="input-field"
                value={quoteAmount}
                onChange={(event) => setQuoteAmount(event.target.value)}
                placeholder="50000"
              />
              <p className="mt-1 text-xs text-slate-500">The client will secure this amount when they accept your quote.</p>
            </div>

            <div className="form-group">
              <label className="label">What the quote covers</label>
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                className="input-field resize-y"
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
                  className="input-field"
                  value={quoteDuration}
                  onChange={(event) => setQuoteDuration(event.target.value)}
                  placeholder="e.g. 2–3 days"
                />
              </div>
              <div className="form-group min-w-0">
                <label className="label">Proposed start date</label>
                <input
                  type="date"
                  className="input-field"
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
                className="btn-ghost px-5 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={quoteSubmitting || !quoteAmount || quoteScope.trim().length < 10}
                className="btn-primary px-5 py-2.5 text-sm"
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

