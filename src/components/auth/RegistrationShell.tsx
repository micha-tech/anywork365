import Link from 'next/link'
import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/layout/BrandLogo'

type RegistrationShellProps = {
  role: string
  eyebrow: string
  title: string
  description: string
  benefits: string[]
  icon: ReactNode
  children: ReactNode
}

export function RegistrationShell({
  role,
  eyebrow,
  title,
  description,
  benefits,
  icon,
  children,
}: RegistrationShellProps) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[linear-gradient(135deg,#f7fbfb_0%,#ffffff_48%,#eef7f6_100%)] px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-28 -top-32 h-96 w-96 rounded-full bg-brand-200/45 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-amber-100/70 blur-3xl" />
      </div>

      <main className="relative mx-auto w-full max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link href="/signup" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-brand-600">
            <span aria-hidden="true">←</span>
            Change account type
          </Link>
          <Link href="/login" className="text-sm font-bold text-brand-600 hover:text-brand-700 hover:underline">
            Log in
          </Link>
        </div>

        <section className="grid overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_28px_75px_rgba(15,23,42,0.12)] lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="relative overflow-hidden bg-[linear-gradient(150deg,#0F4F4A_0%,#0a3835_58%,#041f1e_100%)] p-6 text-white sm:p-8 lg:p-10">
            <div className="absolute -right-16 top-20 h-52 w-52 rounded-full border border-white/10" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-brand-400/15 blur-2xl" />

            <div className="relative flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-lg">
                <BrandLogo href="" size="sm" priority imageClassName="object-contain" />
              </span>
              <div>
                <p className="font-display text-lg font-extrabold">Anywork365</p>
                <p className="text-xs font-medium text-brand-200">Work. Talent. Opportunity.</p>
              </div>
            </div>

            <div className="relative mt-10 lg:mt-20">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-amber-300 shadow-inner backdrop-blur">
                {icon}
              </span>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">{eyebrow}</p>
              <p className="mt-2 text-sm font-semibold text-brand-100">Register as {role}</p>
              <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-100 sm:text-base">{description}</p>
            </div>

            <div className="relative mt-8 space-y-3 border-t border-white/10 pt-6 lg:mt-16">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3 text-sm text-brand-50">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-amber-300">✓</span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="p-5 sm:p-8 lg:p-10 xl:p-12">
            {children}
          </div>
        </section>
      </main>
    </div>
  )
}

export function RegistrationFormHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-7 border-b border-slate-100 pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">Your details</p>
      <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  )
}

export function RegistrationLegalCopy() {
  return (
    <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
      By creating an account, you agree to our{' '}
      <Link href="/terms" className="font-semibold text-brand-600 hover:underline">Terms of Service</Link>
      {' '}and{' '}
      <Link href="/privacy" className="font-semibold text-brand-600 hover:underline">Privacy Policy</Link>.
    </p>
  )
}
