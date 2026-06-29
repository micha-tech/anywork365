'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const ONBOARDING_KEY = 'anywork365_onboarding_seen'

function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window.navigator.userAgent.includes('Capacitor') || (window as any).Capacitor?.isNative)
}

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('page-exit')

    if (!isNativeApp()) {
      setReady(true)
      return
    }

    if (pathname === '/onboarding') {
      setReady(true)
      return
    }

    const seen = sessionStorage.getItem(ONBOARDING_KEY)
    if (seen) {
      setReady(true)
    } else {
      router.replace('/onboarding')
    }
  }, [pathname, router])

  if (!ready) return null

  return <>{children}</>
}
