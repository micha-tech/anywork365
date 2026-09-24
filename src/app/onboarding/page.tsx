'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { StoryArt } from '@/components/ui/StoryArt'
import { BrandWordmark } from '@/components/layout/BrandLogo'

const ONBOARDING_KEY = 'anywork365_onboarding_seen'
const MOBILE_VIEW_QUERY = '(max-width: 767px)'
const AUTH_ENTRY_PATH = '/login'

const slides = [
  {
    image: '/images/onboarding-plumber.jpg',
    title: 'Find artisans in your area',
    description:
      'Search for plumbers, electricians, cleaners, installers and repair services near you. Compare profiles and reviews before you choose.',
    align: 'object-center',
  },
  {
    image: '/images/onboarding-carpenter.jpg',
    title: 'Compare and book',
    description:
      'Review services, message an artisan and agree on the job before work starts.',
    align: 'object-center',
  },
  {
    image: '/images/onboarding-engineers.jpg',
    title: 'Manage the booking from start to finish',
    description:
      'Use chat, booking updates and booking-linked payments until the work is complete.',
    align: 'object-[48%_center]',
  },
  {
    image: '/images/onboarding-mechanic.jpg',
    title: 'Offer your services',
    description:
      'Create a profile, show previous work and receive booking requests from clients.',
    align: 'object-center',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [active, setActive] = useState(0)
  const [showSplash, setShowSplash] = useState(true)
  const touchX = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() === true
    const isMobileWebView = typeof window !== 'undefined' && window.matchMedia(MOBILE_VIEW_QUERY).matches
    if (!isNative && !isMobileWebView) {
      router.replace('/')
      return
    }

    const splashTimer = setTimeout(() => {
      setShowSplash(false)
    }, 1200)

    return () => clearTimeout(splashTimer)
  }, [router])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const complete = useCallback(() => {
    sessionStorage.setItem(ONBOARDING_KEY, 'true')
    document.documentElement.classList.add('page-exit')
    timerRef.current = setTimeout(() => {
      document.documentElement.classList.remove('page-exit')
      router.replace(AUTH_ENTRY_PATH)
    }, 300)
  }, [router])

  const createAccount = useCallback(() => {
    sessionStorage.setItem(ONBOARDING_KEY, 'true')
    document.documentElement.classList.add('page-exit')
    timerRef.current = setTimeout(() => {
      document.documentElement.classList.remove('page-exit')
      router.replace('/signup')
    }, 300)
  }, [router])

  const isLast = active === slides.length - 1

  const goNext = useCallback(() => {
    if (isLast) {
      complete()
      return
    }
    setActive((a) => a + 1)
  }, [isLast, complete])

  const goPrev = useCallback(() => {
    if (active > 0) setActive((a) => a - 1)
  }, [active])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    if (dx > 50) goPrev()
    else if (dx < -50) goNext()
  }, [goNext, goPrev])

  if (showSplash) {
    return <OnboardingSplash />
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white text-slate-900" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="mx-auto flex w-full max-w-lg shrink-0 items-center justify-between gap-4 px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <BrandWordmark href="" priority className="w-44" />
        <button onClick={complete} className="btn-ghost">Skip</button>
      </header>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div key={active} className="animate-setup-step flex flex-1 flex-col justify-center py-6" aria-live="polite">
          <StoryArt kind={active === 0 || active === 3 ? 'people' : active === 1 ? 'work' : 'inbox'} priority className="mx-auto mb-8 max-h-[30dvh] w-full object-contain" />
          <p className="mb-3 text-sm font-semibold text-brand-500">A better way to work together</p>
          <h1 className="page-heading">{slides[active].title}</h1>
          <p className="page-description">{slides[active].description}</p>
        </div>
        <div className="mb-6 flex justify-center gap-2" aria-label={`Step ${active + 1} of ${slides.length}`}>
          {slides.map((slide, i) => <button key={slide.title} aria-label={`Go to step ${i + 1}`} aria-current={i === active ? 'step' : undefined} onClick={() => setActive(i)} className="flex h-11 min-w-8 items-center justify-center"><span className={`h-2 rounded-full ${i === active ? 'w-7 bg-brand-500' : 'w-2 bg-slate-300'}`} /></button>)}
        </div>
        <button onClick={goNext} className="btn-primary w-full text-base">{isLast ? 'Log in' : 'Continue'}</button>
        <button onClick={isLast ? createAccount : complete} className="btn-ghost mt-3 w-full">{isLast ? 'Create account' : 'Skip to login'}</button>
      </div>
    </div>
  )
}

function OnboardingSplash() {
  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-brand-900 px-6 text-center text-white">

      <div className="relative flex flex-col items-center">
        <div className="mb-7 flex min-h-[76px] items-center justify-center rounded-xl bg-white px-5 py-4 shadow-[0_22px_60px_rgba(0,0,0,0.24)]">
          <BrandWordmark href="" priority className="w-[280px] max-w-[78vw]" />
        </div>

        <h1 className="max-w-xs text-2xl font-extrabold leading-tight text-white">
          Find work. Hire skilled people.
        </h1>

        <div className="mt-8 flex items-center justify-center gap-2" aria-label="Loading onboarding">
          <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.1s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand-300" />
        </div>
      </div>
    </div>
  )
}
