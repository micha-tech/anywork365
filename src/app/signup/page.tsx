'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandWordmark } from '@/components/layout/BrandLogo'
import { AuthDivider } from '@/components/auth/GoogleAuthButton'
import { isGoogleUser, onAuthChange, signOut as signOutFirebase } from '@/lib/firebase/auth'
import { getGoogleProfile } from '@/lib/google-auth'

const accountTypes = [
  {
    href: '/signup/client',
    title: 'Client',
    description: 'Find artisans, book services and manage your jobs.',
    icon: ClientIcon,
    accent: 'bg-brand-50 text-brand-600 group-hover:bg-brand-500 group-hover:text-white',
  },
  {
    href: '/signup/artisan',
    title: 'Artisan',
    description: 'List your services and receive requests from clients.',
    icon: ArtisanIcon,
    accent: 'bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white',
  },
  {
    href: '/signup/professional',
    title: 'Professional',
    description: 'Create a profile and apply for job opportunities.',
    icon: ProfessionalIcon,
    accent: 'bg-sky-50 text-sky-600 group-hover:bg-sky-500 group-hover:text-white',
  },
  {
    href: '/signup/recruiter',
    title: 'Recruiter',
    description: 'Post jobs, review applicants and manage hiring.',
    icon: RecruiterIcon,
    accent: 'bg-violet-50 text-violet-600 group-hover:bg-violet-500 group-hover:text-white',
  },
] as const

export default function SignupPage() {
  const [googleEmail, setGoogleEmail] = useState('')

  useEffect(() => {
    try {
      return onAuthChange((user) => {
        if (
          sessionStorage.getItem('anywork365_google_signup') === '1' &&
          isGoogleUser(user) &&
          user
        ) {
          setGoogleEmail(getGoogleProfile(user).email)
        }
      })
    } catch {
      return undefined
    }
  }, [])

  async function switchToEmailSignup() {
    await signOutFirebase().catch(() => undefined)
    sessionStorage.removeItem('anywork365_google_signup')
    setGoogleEmail('')
  }

  return (
    <div className="min-h-dvh bg-white px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <main className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-4xl items-center justify-center sm:min-h-[calc(100dvh-5rem)]">
        <section className="w-full bg-white">
          <div className="bg-white py-2 sm:py-4">
            <div className="mb-8 flex items-center justify-center">
              <BrandWordmark priority className="w-[245px] sm:w-[285px]" />
            </div>

            <div className="mx-auto max-w-xl">
              <div className="text-center">
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Choose an account type</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
                  Choose the option that best describes how you want to use Anywork365.
                </p>
              </div>

              {googleEmail && (
                <div className="mt-7">
                  <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-brand-800">Google account connected</p>
                    <p className="mt-0.5 truncate text-xs text-brand-700">{googleEmail}</p>
                    <p className="mt-1 text-xs text-slate-500">Choose an account type below to finish setting up your profile.</p>
                    <button
                      type="button"
                      onClick={switchToEmailSignup}
                      className="mt-2 text-xs font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4"
                    >
                      Use email instead
                    </button>
                  </div>
                  <AuthDivider label="choose your account type" />
                </div>
              )}

              <div className={`grid gap-3 sm:grid-cols-2 ${googleEmail ? '' : 'mt-7'}`}>
                {accountTypes.map(({ href, title, description, icon: Icon, accent }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex min-h-[82px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_15px_34px_rgba(15,79,74,0.11)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 sm:p-4"
                  >
                    <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-colors duration-200 sm:h-14 sm:w-14 ${accent}`}>
                      <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-bold text-slate-900 sm:text-lg">{title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 sm:text-sm">{description}</span>
                    </span>
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-all group-hover:border-brand-500 group-hover:bg-brand-500 group-hover:text-white" aria-hidden="true">
                      <ArrowIcon className="h-4 w-4" />
                    </span>
                  </Link>
                ))}
              </div>

              <p className="mt-7 text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link href="/login" className="font-bold text-brand-600 hover:text-brand-700 hover:underline">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function ClientIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" /></svg>
}

function ArtisanIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14.7 6.3 3-3a4 4 0 0 1-5 5L6 15l-3 1 1-3 6.7-6.7a4 4 0 0 1 5-5l-3 3 2 2Z" /><path d="m14 14 6 6" /></svg>
}

function ProfessionalIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></svg>
}

function RecruiterIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 19c.6-3.6 2.6-5.4 6-5.4 1.2 0 2.3.2 3.1.7" /><circle cx="17" cy="16" r="3" /><path d="m19.2 18.2 2.3 2.3" /></svg>
}

function ArrowIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
}
