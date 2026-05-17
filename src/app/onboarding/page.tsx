'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination, EffectFade } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/effect-fade'

const ONBOARDING_KEY = 'anywork365_onboarding_done'

const slides = [
  {
    image: '/images/onboarding-1.png',
    title: 'Find Trusted Professionals',
    description: 'Browse verified artisans, technicians, and vendors across Nigeria. Read reviews and compare ratings before you book.',
    gradient: 'from-emerald-50 via-white to-teal-50',
  },
  {
    image: '/images/onboarding-2.png',
    title: 'Book & Pay with Confidence',
    description: 'Payments are held securely in escrow. Funds are only released when you\'re satisfied with the work — no more guesswork.',
    gradient: 'from-teal-50 via-white to-emerald-50',
  },
  {
    image: '/images/onboarding-3.png',
    title: 'Track Every Step',
    description: 'From booking to completion, follow your job in real time. Chat with your professional, get updates, and leave a review.',
    gradient: 'from-emerald-50 via-white to-teal-50',
  },
  {
    image: '/images/onboarding-4.png',
    title: 'Grow Your Business',
    description: 'Create your professional profile, showcase your work, and get discovered by clients in your area. Join thousands of pros on Anywork365.',
    gradient: 'from-teal-50 via-white to-emerald-50',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const swiperRef = useRef<SwiperType | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY)
    if (done) router.replace('/login')
  }, [router])

  const complete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setExiting(true)
    setTimeout(() => router.replace('/login'), 400)
  }

  const skip = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setExiting(true)
    setTimeout(() => router.replace('/login'), 400)
  }

  const isLast = activeIndex === slides.length - 1

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-white transition-all duration-500 ${exiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
      {/* Skip button */}
      <div className="absolute top-0 inset-x-0 z-10 flex justify-end px-6 pt-safe">
        <button
          onClick={skip}
          className="mt-4 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 active:scale-95 transition-all"
        >
          Skip
        </button>
      </div>

      {/* Carousel */}
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <Swiper
          modules={[Autoplay, Pagination, EffectFade]}
          effect="fade"
          fadeEffect={{ crossFade: true }}
          speed={600}
          autoplay={{ delay: 5000, disableOnInteraction: true }}
          pagination={{
            clickable: true,
            renderBullet: (_index: number, className: string) =>
              `<span class="${className} !w-2.5 !h-2.5 !rounded-full !transition-all !duration-300"></span>`,
          }}
          onSwiper={(s) => { swiperRef.current = s }}
          onSlideChange={(s) => setActiveIndex(s.activeIndex)}
          className="!h-full !w-full"
        >
          {slides.map((slide, i) => (
            <SwiperSlide key={i} className="!flex !flex-col !items-center !justify-center !h-full px-6 sm:px-10">
              <div className={`flex flex-col items-center text-center max-w-sm mx-auto bg-gradient-to-b ${slide.gradient} rounded-3xl p-0 sm:p-0 w-full overflow-hidden`}>
                {/* Image */}
                <div className="w-full aspect-[4/3] relative mb-6">
                  <img
                    src={slide.image}
                    alt=""
                    className="w-full h-full object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                </div>

                {/* Title */}
                <div className="px-6 pb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 leading-tight">
                    {slide.title}
                  </h2>

                  {/* Description */}
                  <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-xs mx-auto">
                    {slide.description}
                  </p>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Bottom area */}
      <div className="px-6 pb-8 pt-2 flex flex-col items-center gap-4 keyboard-safe">
        <button
          onClick={isLast ? complete : () => swiperRef.current?.slideNext()}
          className="w-full max-w-xs h-14 rounded-2xl bg-brand-500 hover:bg-brand-600 active:scale-[0.97] text-white font-semibold text-base transition-all duration-200 shadow-lg shadow-brand-500/25"
        >
          {isLast ? 'Get Started' : 'Continue'}
        </button>

        {!isLast && (
          <button
            onClick={complete}
            className="text-sm text-slate-400 hover:text-slate-600 active:scale-95 transition-all py-1"
          >
            Get started
          </button>
        )}
      </div>
    </div>
  )
}
