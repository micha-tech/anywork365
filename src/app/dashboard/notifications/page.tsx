'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface NotificationItem {
  id: number
  body: string
  createdAt: string
  isRead: boolean
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  async function loadNotifications() {
    try {
      const response = await fetch('/api/notifications')
      const data = await response.json()
      if (data.success) setNotifications(data.data.notifications || [])
    } catch {
      toast.error('Could not load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  async function markAllRead() {
    setMarkingAll(true)
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error('Could not update notifications')
        return
      }
      setNotifications(data.data.notifications || [])
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-4 sm:mb-7">
        <div>
          <h1 className="font-display text-xl font-semibold sm:text-2xl">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">Booking requests, status changes, and account updates</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={markingAll}
            className="btn-ghost flex-shrink-0 px-3 py-2 text-xs disabled:opacity-50"
          >
            {markingAll ? 'Updating...' : 'Mark all read'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="border-y border-slate-200 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">No notifications yet</p>
          <p className="mt-1 text-sm text-slate-500">Booking updates will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`relative py-4 pl-5 pr-3 ${notification.isRead ? 'bg-white' : 'bg-brand-50/50'}`}
            >
              {!notification.isRead && (
                <span className="absolute left-0 top-6 h-2 w-2 rounded-full bg-brand-500" aria-label="Unread" />
              )}
              <p className="text-sm leading-relaxed text-slate-800">{notification.body}</p>
              <time className="mt-1.5 block text-xs text-slate-400">
                {new Date(notification.createdAt).toLocaleString()}
              </time>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
