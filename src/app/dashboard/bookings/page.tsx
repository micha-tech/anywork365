'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Modal } from '@/components/ui/Modal'

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
  status: string
  createdAt: string
}

export default function BookingsPage() {
  const { user, loading } = useCurrentUser()
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const [reviewBooking, setReviewBooking] = useState<BookingItem | null>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  function loadBookings() {
    setFetching(true)
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setBookings(res.data)
        else setError(res.error || 'Failed to load bookings')
      })
      .catch(() => setError('Failed to load bookings'))
      .finally(() => setFetching(false))
  }

  useEffect(() => {
    if (!loading && user) loadBookings()
    if (!loading && !user) setFetching(false)
  }, [user, loading])

  async function handleAction(bookingId: number, action: string) {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (data.success) {
      loadBookings()
    } else {
      alert(data.error || 'Action failed')
    }
  }

  async function handleSubmitReview() {
    if (!reviewBooking || reviewRating === 0 || !reviewComment.trim()) return
    setReviewError('')
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
        setReviewError(data.error || 'Failed to submit review')
        return
      }
      setReviewBooking(null)
      setReviewRating(0)
      setReviewComment('')
      loadBookings()
    } catch {
      setReviewError('Network error. Please try again.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  function openReview(b: BookingItem) {
    setReviewBooking(b)
    setReviewRating(0)
    setReviewComment('')
    setReviewError('')
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  const isVendor = user?.role === 'vendor'

  return (
    <>
      <div className="mb-5 sm:mb-7">
        <h1 className="font-display text-xl sm:text-2xl font-semibold">My Bookings</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isVendor ? 'Manage your incoming job requests' : 'Track your service bookings'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:gap-4">
        {fetching ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading bookings...</p>
        ) : bookings.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-slate-500 mb-3">No bookings yet</p>
            {!isVendor && (
              <Link href="/professionals" className="btn-primary inline-flex px-6 py-2.5 text-sm">
                Browse Vendors
              </Link>
            )}
          </div>
        ) : bookings.map((b) => (
          <div key={b.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-500 mb-1">
                  {isVendor ? (b.clientName || 'Client') : (b.businessName || 'Vendor')} &middot; Booking #{b.id} &middot; {new Date(b.createdAt).toLocaleDateString()}
                </p>
                <p className="font-medium text-sm leading-snug mb-2">{b.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Budget: <strong className="text-slate-900">₦{b.budget?.toLocaleString()}</strong></span>
                  <span>Date: {b.date}</span>
                  {b.location && <span>Location: {b.location}</span>}
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize flex-shrink-0 ${statusColors[b.status] || 'bg-gray-100 text-gray-600'}`}>
                {b.status}
              </span>
            </div>

            {(b.status === 'pending' || b.status === 'confirmed') && (
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                {isVendor && b.status === 'pending' && (
                  <button
                    onClick={() => handleAction(b.id, 'confirm')}
                    className="btn-primary text-xs px-4 py-2"
                  >
                    Accept Booking
                  </button>
                )}
                {!isVendor && b.status === 'confirmed' && (
                  <button
                    onClick={() => handleAction(b.id, 'complete')}
                    className="btn-primary text-xs px-4 py-2"
                  >
                    Mark Complete
                  </button>
                )}
                {b.status === 'pending' && (
                  <button
                    onClick={() => handleAction(b.id, 'cancel')}
                    className="btn-ghost text-xs px-4 py-2 text-red-500 border-red-200 hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
            {!isVendor && b.status === 'completed' && (
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                <button
                  onClick={() => openReview(b)}
                  className="btn-primary text-xs px-4 py-2"
                >
                  Leave a Review
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal open={reviewBooking !== null} onClose={() => setReviewBooking(null)} title="Leave a Review">
        {reviewBooking && (
          <div>
            <p className="text-sm text-slate-500 mb-4">
              Rate your experience with <strong>{reviewBooking.businessName || 'this vendor'}</strong>
            </p>

            {reviewError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
                {reviewError}
              </div>
            )}

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
    </>
  )
}
