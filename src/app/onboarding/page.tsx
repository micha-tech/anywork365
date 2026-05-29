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
  const [direction, setDirection] = useState(0)
  const touchX = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY)) {
      router.replace('/login')
    }
  }, [router])

  useEffect(() => {
    slideTimerRef.current = setInterval(() => {
      setActive((prev) => {
        if (prev >= slides.length - 1) return prev
        setDirection(1)
        return prev + 1
      })
    }, 5000)
    return () => clearInterval(slideTimerRef.current)
  }, [])

  const complete = useCallback(() => {
    clearInterval(slideTimerRef.current)
    localStorage.setItem(ONBOARDING_KEY, 'true')
    document.documentElement.classList.add('page-exit')
    timerRef.current = setTimeout(() => {
      document.documentElement.classList.remove('page-exit')
      router.replace('/login')
    }, 300)
  }, [router])

  const isLast = active === slides.length - 1

  const goNext = useCallback(() => {
    clearInterval(slideTimerRef.current)
    if (isLast) { complete(); return }
    setDirection(1)
    setActive((a) => a + 1)
  }, [isLast, complete])

  const goPrev = useCallback(() => {
    if (active <= 0) return
    setDirection(-1)
    setActive((a) => a - 1)
  }, [active])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    clearInterval(slideTimerRef.current)
    touchX.current = e.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    if (dx > 50) goPrev()
    else if (dx < -50) goNext()
  }, [goNext, goPrev])

  const slideInFrom = direction > 0 ? 'translateX(40px)' : 'translateX(-40px)'
  const slideOutTo = direction > 0 ? 'translateX(-40px)' : 'translateX(40px)'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-emerald-50 via-white to-white" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 pt-safe">
        <div className="flex gap-1 pt-5">
          {slides.map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full bg-slate-200 overflow-hidden min-w-[32px]">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-[400ms] ease-out"
                style={{
                  width: i < active ? '100%' : i === active ? '100%' : '0%',
                  opacity: i === active ? 1 : i < active ? 0.3 : 0,
                }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={complete}
          className="pt-5 px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-700 active:scale-95 transition-all min-h-[44px]"
        >
          Skip
        </button>
      </div>

      <div className="flex-1 relative mt-12">
        {slides.map((slide, i) => {
          const isActive = i === active
          const isPrev = i === active - 1
          const isNext = i === active + 1
          const leaving = (isPrev && direction > 0) || (isNext && direction < 0)

          let xOffset = '0'
          let opacity = 1
          let scale = 1

          if (leaving) {
            xOffset = slideOutTo
            opacity = 0
            scale = 0.92
          } else if (isNext && direction > 0) {
            xOffset = slideInFrom
            opacity = 0
            scale = 0.92
          } else if (isPrev && direction < 0) {
            xOffset = slideInFrom
            opacity = 0
            scale = 0.92
          }

          return (
            <div
              key={i}
              className="absolute inset-0 flex flex-col items-center justify-center px-5 sm:px-10"
              style={{
                opacity,
                transform: `${xOffset} scale(${scale})`,
                transition: 'opacity 0.45s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div className="w-full max-w-xs sm:max-w-sm mx-auto flex flex-col items-center text-center">
                <div className="relative w-full mb-8 overflow-hidden rounded-3xl bg-gradient-to-b from-brand-50 to-emerald-50/50" style={{ height: 'clamp(220px, 48dvh, 340px)' }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent z-10" />
                  {i <= active + 1 && (
                    <Image
                      src={slide.image}
                      alt=""
                      fill
                      sizes="(max-width: 480px) 90vw, 384px"
                      className={`object-contain p-4 sm:p-6 transition-transform duration-700 ${isActive ? 'scale-100' : 'scale-95'}`}
                      priority={i === 0}
                    />
                  )}
                </div>
                <h2 className="text-[clamp(1.25rem,5.5vw,1.75rem)] font-bold text-slate-900 mb-3 leading-tight text-balance">
                  {slide.title}
                </h2>
                <p className="text-[clamp(0.875rem,3.5vw,1rem)] text-slate-500 leading-relaxed text-balance max-w-xs">
                  {slide.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-5 pb-safe pb-8 pt-2 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2" aria-label="Slide indicator">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { clearInterval(slideTimerRef.current); setDirection(i > active ? 1 : -1); setActive(i) }}
              className="rounded-full transition-all duration-500 ease-out"
              style={{
                width: i === active ? 28 : 7,
                height: 7,
                background: i === active ? '#0F4F4A' : '#cbd5e1',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          className="w-full max-w-xs h-14 rounded-2xl bg-brand-500 hover:bg-brand-600 active:scale-[0.97] text-white font-semibold text-base transition-all duration-200 shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
        >
          {isLast ? (
            'Get Started'
          ) : (
            <>
              Continue
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
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
