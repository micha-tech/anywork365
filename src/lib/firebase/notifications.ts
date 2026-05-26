'use client'

import { useEffect, useState, useCallback } from 'react'
import { getFirebaseApp } from './client'
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging'
import { saveFcmToken } from '@/lib/queries'

let messagingInstance: Messaging | null = null

if (typeof window !== 'undefined') {
  try {
    messagingInstance = getMessaging(getFirebaseApp())
  } catch {
    // Firebase messaging not available in this environment
  }
}

export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = useCallback(async (userId?: string) => {
    setLoading(true)
    setError(null)

    try {
      if (!messagingInstance) {
        throw new Error('Firebase messaging not available')
      }

      const granted = await Notification.requestPermission()
      setPermission(granted)

      if (granted === 'granted') {
        const fcmToken = await getToken(messagingInstance, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        })

        if (fcmToken) {
          setToken(fcmToken)
          if (userId) {
            await saveFcmToken(userId, fcmToken)
          }
          return fcmToken
        }
      }

      return null
    } catch {
      setError('Failed to enable notifications. Please try again.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { token, permission, loading, error, requestPermission }
}

export function useMessageListener() {
  const [payload, setPayload] = useState<unknown>(null)

  useEffect(() => {
    if (!messagingInstance) return

    const unsubscribe = onMessage(messagingInstance, (msg) => {
      setPayload(msg)
      showNotification(
        msg.notification?.title || 'New Notification',
        { body: msg.notification?.body, icon: '/logo.png' }
      )
    })

    return () => unsubscribe()
  }, [])

  return payload
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { icon: '/logo.png', badge: '/logo.png', ...options })
    }
  }
}
