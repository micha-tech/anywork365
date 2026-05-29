'use client'

import { useEffect, useCallback } from 'react'
import { getFirebaseApp } from '@/lib/firebase/client'
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging'
import { saveFcmToken, deleteFcmToken } from '@/lib/queries'

let messaging: Messaging | null = null
try {
  if (typeof window !== 'undefined') {
    messaging = getMessaging(getFirebaseApp())
  }
} catch {
  messaging = null
}

let isListeningSetup = false

export function useNotifications(userId?: string) {
  const handleForegroundMessage = useCallback((payload: any) => {
    console.log('Foreground message received:', payload)

    const { title, body, image } = payload.notification || {}
    
    if (title && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: image || '/logo.png',
          badge: '/logo.png',
          tag: payload.data?.notification_id || 'default',
          data: payload.data,
        })
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !messaging || isListeningSetup) return

    isListeningSetup = true

    const unsubscribe = onMessage(messaging, handleForegroundMessage)

    return () => {
      unsubscribe()
      isListeningSetup = false
    }
  }, [handleForegroundMessage])

  const requestPermission = useCallback(async (): Promise<string | null> => {
    if (!messaging) {
      console.error('Firebase messaging not initialized')
      return null
    }

    try {
      const permission = await Notification.requestPermission()
      
      if (permission === 'granted') {
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
        
        if (!vapidKey) {
          console.error('VAPID key not configured')
          return null
        }

        const token = await getToken(messaging, { vapidKey })
        
        if (token && userId) {
          await saveFcmToken(userId, token)
        }

        return token
      }

      console.warn('Notification permission denied')
      return null
    } catch (error) {
      console.error('Error getting FCM token:', error)
      return null
    }
  }, [userId])

  const saveToken = useCallback(async (token: string) => {
    if (!userId) return
    try {
      await saveFcmToken(userId, token)
    } catch (error) {
      console.error('Failed to save FCM token:', error)
    }
  }, [userId])

  const deleteToken = useCallback(async (token: string) => {
    if (!userId) return
    try {
      await deleteFcmToken(token)
    } catch (error) {
      console.error('Failed to delete FCM token:', error)
    }
  }, [userId])

  return {
    requestPermission,
    saveToken,
    deleteToken,
    isSupported: typeof window !== 'undefined' && 'Notification' in window && !!messaging,
  }
}

export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission
  }
  return null
}

export function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.requestPermission()
  }
  return Promise.resolve(null)
}