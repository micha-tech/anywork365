'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const ONBOARDING_KEY = 'anywork365_onboarding_done'

const slides = [
  {
    image: '/images/onboarding-1.webp',
    title: 'Find Trusted Professionals',
    description:
      'Browse verified artisans, technicians, and vendors across Nigeria. Read reviews and compare ratings before you book.',
  },
  {
    image: '/images/onboarding-2.webp',
    title: 'Book & Pay with Confidence',
    description:
      "Payments are held securely in escrow. Funds are only released when you're satisfied with the work.",
  },
  {
    image: '/images/onboarding-3.webp',
    title: 'Track Every Step',
    description:
      'From booking to completion, follow your job in real time. Chat with your professional and get updates.',
  },
  {
    image: '/images/onboarding-4.webp',
    title: 'Grow Your Business',
    description:
      'Create your professional profile, showcase your work, and get discovered by clients in your area.',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [active, setActive] = useState(0)
  const touchX = useRef(0)

  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY)) {
      router.replace('/login')
    }
  }, [router])

  const complete = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    document.documentElement.classList.add('page-exit')
    setTimeout(() => {
      document.documentElement.classList.remove('page-exit')
      router.replace('/login')
    }, 300)
  }, [router])

  const isLast = active === slides.length - 1

  const goNext = useCallback(() => {
    if (isLast) { complete(); return }
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="absolute top-0 inset-x-0 z-10 flex justify-end px-5 pt-safe">
        <button
          onClick={complete}
          className="mt-4 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 active:scale-95 transition-all min-h-[44px]"
        >
          Skip
        </button>
      </div>

      <div className="flex-1 relative">
        {slides.map((slide, i) => {
          const offset = i < active ? -32 : 32
          return (
            <div
              key={i}
              className="absolute inset-0 flex flex-col items-center justify-center px-5 sm:px-10"
              style={{
                opacity: i === active ? 1 : 0,
                transform: i === active ? 'translateX(0)' : `translateX(${offset}px)`,
                transition: 'opacity 0.35s ease, transform 0.35s ease',
                pointerEvents: i === active ? 'auto' : 'none',
              }}
            >
              <div className="w-full max-w-xs sm:max-w-sm mx-auto flex flex-col items-center text-center">
                <div className="relative w-full mb-6 overflow-hidden rounded-2xl bg-slate-100" style={{ height: 'clamp(200px, 45dvh, 320px)' }}>
                  {i <= active + 1 && (
                    <Image
                      src={slide.image}
                      alt=""
                      fill
                      sizes="(max-width: 480px) 90vw, 384px"
                      className="object-contain"
                      priority={i === 0}
                    />
                  )}
                </div>
                <h2 className="text-[clamp(1.125rem,5vw,1.75rem)] font-bold text-slate-900 mb-3 leading-tight text-balance">
                  {slide.title}
                </h2>
                <p className="text-[clamp(0.8125rem,3.5vw,1rem)] text-slate-500 leading-relaxed text-balance break-words">
                  {slide.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-5 pb-safe pb-6 pt-2 flex flex-col items-center gap-4">
        <div className="flex items-center gap-1.5" aria-label="Slide indicator">
          {slides.map((_, i) => (
            <span
              key={i}
              className="block transition-all duration-300 rounded-full"
              style={{
                width: i === active ? 20 : 6,
                height: 6,
                background: i === active ? '#0F4F4A' : '#cbd5e1',
              }}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          className="w-full max-w-xs h-14 rounded-2xl bg-brand-500 hover:bg-brand-600 active:scale-[0.97] text-white font-semibold text-base transition-all duration-200 shadow-lg shadow-brand-500/25"
        >
          {isLast ? 'Get Started' : 'Continue'}
        </button>

        {!isLast && (
          <button
            onClick={complete}
            className="text-sm text-slate-400 hover:text-slate-600 active:scale-95 transition-all py-1 min-h-[44px]"
          >
            Get started
          </button>
        )}
      </div>
    </div>
  )
}
