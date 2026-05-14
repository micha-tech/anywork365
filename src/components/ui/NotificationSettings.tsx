'use client'

import { useState } from 'react'
import { useNotifications } from '@/lib/firebase/hooks'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export function NotificationSettings() {
  const { user } = useCurrentUser()
  const { requestPermission, saveToken, isSupported } = useNotifications(user?.id)
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async () => {
    if (enabled) {
      setEnabled(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const token = await requestPermission()
      if (token) {
        await saveToken(token)
        setEnabled(true)
      } else {
        setError('Failed to enable notifications. Please check your browser settings.')
      }
    } catch (err) {
      setError('An error occurred while enabling notifications.')
    } finally {
      setLoading(false)
    }
  }

  if (!isSupported) {
    return null
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-slate-900">Push Notifications</p>
            <p className="text-sm text-slate-500">
              Get alerts for bookings, messages, and updates
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            enabled ? 'bg-brand-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </span>
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

export function NotificationBadge({ count }: { count: number }) {
  if (count === 0) return null

  return (
    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  )
}