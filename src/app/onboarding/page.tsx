'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const ONBOARDING_KEY = 'anywork365_onboarding_seen'

const slides = [
  {
    image: '/images/onboarding-plumber.jpg',
    eyebrow: 'Home services',
    title: 'Trusted help is closer than you think',
    description:
      'Find skilled plumbers, electricians, cleaners, installers, and repair experts near you, with reviews that help you choose confidently.',
    proof: 'Verified profiles. Real reviews.',
    align: 'object-center',
  },
  {
    image: '/images/onboarding-carpenter.jpg',
    eyebrow: 'Quality work',
    title: 'Book professionals who take pride in the details',
    description:
      'Compare services, message the right expert, agree on the job, and move forward with clarity before anyone starts work.',
    proof: 'Clear choices. Better outcomes.',
    align: 'object-center',
  },
  {
    image: '/images/onboarding-engineers.jpg',
    eyebrow: 'Secure flow',
    title: 'Stay in control from booking to completion',
    description:
      'Use chat, job updates, and escrow-supported payments to keep every booking transparent until the work is done.',
    proof: 'Chat. Track. Pay with confidence.',
    align: 'object-[48%_center]',
  },
  {
    image: '/images/onboarding-mechanic.jpg',
    eyebrow: 'For professionals',
    title: 'Turn your skill into steady local demand',
    description:
      'Create a profile, showcase your work, receive bookings, and build trust with customers looking for reliable service providers.',
    proof: 'Get discovered. Get booked.',
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
    const splashTimer = setTimeout(() => {
      setShowSplash(false)
    }, 1200)

    return () => clearTimeout(splashTimer)
  }, [])

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
      router.replace('/')
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
    <div
      className="fixed inset-0 z-50 flex min-h-dvh flex-col overflow-hidden bg-slate-950 text-white"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute inset-0">
        {slides.map((slide, i) => (
          <div
            key={slide.image}
            className="absolute inset-0"
            style={{
              opacity: i === active ? 1 : 0,
              transform: i === active ? 'scale(1)' : 'scale(1.035)',
              transition: 'opacity 0.7s ease, transform 1.6s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            aria-hidden={i !== active}
          >
            {i <= active + 1 && (
              <Image
                src={slide.image}
                alt=""
                fill
                sizes="100vw"
                className={`${slide.align} object-cover`}
                priority={i === 0}
              />
            )}
          </div>
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,31,30,0.42)_0%,rgba(4,31,30,0.08)_34%,rgba(4,31,30,0.54)_62%,rgba(3,15,14,0.96)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,rgba(2,6,23,0.58),rgba(2,6,23,0))]" />
      </div>

      <div className="relative z-10 flex items-center justify-between px-5 pt-safe">
        <div className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-xs font-semibold text-white">Anywork365</span>
        </div>
        <button
          onClick={complete}
          className="mt-4 min-h-[44px] rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur-md transition-all hover:bg-white/20 hover:text-white active:scale-95"
        >
          Skip
        </button>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-end px-5 pb-safe">
        <div className="mx-auto w-full max-w-md pb-6">
          <div className="mb-5 flex items-center gap-2" aria-label="Slide indicator">
            {slides.map((_, i) => (
              <span
                key={i}
                className="block h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: i === active ? 30 : 7,
                  background: i === active ? '#F59E0B' : 'rgba(255,255,255,0.42)',
                }}
              />
            ))}
          </div>

        {slides.map((slide, i) => {
          const offset = i < active ? -18 : 18
          return (
            <div
              key={slide.title}
              className={i === active ? 'relative' : 'pointer-events-none absolute inset-x-5 bottom-[9.75rem]'}
              style={{
                opacity: i === active ? 1 : 0,
                transform: i === active ? 'translateY(0)' : `translateY(${offset}px)`,
                transition: 'opacity 0.52s ease, transform 0.52s cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: i === active ? 'auto' : 'none',
              }}
              aria-live={i === active ? 'polite' : undefined}
            >
              <div className="max-w-[21.5rem]">
                <p className="mb-3 inline-flex rounded-lg bg-brand-500/90 px-3 py-1.5 text-xs font-bold text-white shadow-[0_12px_32px_rgba(15,79,74,0.28)]">
                  {slide.eyebrow}
                </p>
                <h1 className="font-display text-[clamp(2rem,8vw,3rem)] font-extrabold leading-[1.02] text-white text-balance">
                  {slide.title}
                </h1>
                <p className="mt-4 text-[15px] leading-relaxed text-white/80 text-balance">
                  {slide.description}
                </p>
                <p className="mt-4 text-sm font-semibold text-amber-300">
                  {slide.proof}
                </p>
              </div>
            </div>
          )
        })}

        <button
          onClick={goNext}
          className="mt-7 flex h-14 w-full items-center justify-center rounded-lg bg-brand-500 text-base font-bold text-white shadow-[0_18px_44px_rgba(15,79,74,0.35)] transition-all duration-200 hover:bg-brand-600 active:scale-[0.98]"
        >
          {isLast ? 'Get Started' : 'Continue'}
        </button>

        {!isLast && (
          <button
            onClick={complete}
            className="mt-3 min-h-[44px] w-full rounded-lg text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
          >
            I am ready, take me in
          </button>
        )}
        </div>
      </div>
    </div>
  )
}

function OnboardingSplash() {
  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-brand-900 px-6 text-center text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(59,166,159,0.32),transparent_36%),linear-gradient(180deg,#0F4F4A_0%,#041f1e_100%)]" />
      <div className="relative flex flex-col items-center">
        <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-lg border border-white/10 bg-white shadow-[0_22px_60px_rgba(0,0,0,0.24)]">
          <Image
            src="/logo.png"
            alt="Anywork365.ng"
            width={512}
            height={512}
            priority
            className="h-24 w-24 object-contain"
          />
        </div>

        <p className="text-xs font-bold text-amber-300">Anywork365</p>
        <h1 className="mt-3 max-w-xs text-2xl font-extrabold leading-tight text-white">
          Trusted professionals for everyday work
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
