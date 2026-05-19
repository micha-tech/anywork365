'use client'

import { useEffect, useRef } from 'react'

function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const cap = (window as any).Capacitor
    return cap?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

export function useAppPushNotifications(onConversationOpen?: (conversationId: string) => void) {
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    if (isCapacitorNative()) {
      initCapacitorPush()
    } else {
      initWebPush()
    }

    async function initCapacitorPush() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        PushNotifications.addListener('registration', async (tokenResult) => {
          try {
            await fetch('/api/notifications/register-fcm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: tokenResult.value }),
            })
          } catch (err) {
            console.error('[Capacitor Push] Failed to register FCM token', err)
          }
        })

        PushNotifications.addListener('registrationError', (err) => {
          console.error('[Capacitor Push] Registration error', err)
        })

        PushNotifications.addListener('pushNotificationReceived', () => {
          // foreground notification handled by OS
        })

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = action.notification.data
          if (data?.conversationId) {
            window.location.href = `/messages?conversationId=${data.conversationId}`
          } else if (data?.bookingId) {
            window.location.href = `/dashboard/bookings`
          } else {
            window.location.href = data?.url || '/messages'
          }
        })

        await PushNotifications.requestPermissions()
        await PushNotifications.register()
      } catch (err) {
        console.log('[Capacitor Push] Not available', err)
      }
    }

    async function initWebPush() {
      const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!VAPID_KEY) return
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

      try {
        const registration = await navigator.serviceWorker.register('/push-sw.js')
        const permission = await registration.pushManager.permissionState()
        if (permission === 'granted' || permission === 'prompt') {
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
          })
        }
      } catch (err) {
        console.error('[Web Push] Registration error', err)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'open_conversation' && onConversationOpen) {
        onConversationOpen(event.data.conversationId)
      }
    })
  }, [onConversationOpen])
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}
