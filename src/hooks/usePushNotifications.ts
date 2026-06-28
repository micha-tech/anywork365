'use client'

import { useEffect, useCallback, useRef } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  if (!base64String) return new ArrayBuffer(0)
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}

export function usePushNotifications(onConversationOpen?: (conversationId: string) => void) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const subscribedRef = useRef(false)

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      console.log('Push notifications: No VAPID key configured')
      return
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported')
      return
    }

    if (subscribedRef.current) return

    try {
      const registration = await navigator.serviceWorker.register('/push-sw.js')
      registrationRef.current = registration

      const permission = await registration.pushManager.permissionState()
      if (permission === 'granted') {
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
        subscribedRef.current = true
      } else if (permission === 'prompt') {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
        
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.getKey('p256dh'),
              auth: subscription.getKey('auth'),
            },
          }),
        })
        subscribedRef.current = true
      }
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'open_conversation' && onConversationOpen) {
        onConversationOpen(event.data.conversationId)
      }
    })
  }, [onConversationOpen])

  useEffect(() => {
    subscribe()
  }, [subscribe])

  return { subscribe }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return Promise.resolve('denied' as NotificationPermission)
  }
  
  return Notification.requestPermission()
}

export function showLocalNotification(title: string, body: string, icon?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  new Notification(title, {
    body,
    icon: icon || '/logo.png',
    badge: '/logo.png',
  })
}
