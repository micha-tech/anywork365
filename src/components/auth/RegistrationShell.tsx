import Image from 'next/image'
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
  imageSrc: string
  imageAlt: string
  imagePosition?: string
  children: ReactNode
}

export function RegistrationShell({
  role,
  eyebrow,
  title,
  description,
  benefits,
  icon,
  imageSrc,
  imageAlt,
  imagePosition = 'center',
  children,
}: RegistrationShellProps) {
  return (
    <div className="min-h-dvh bg-[#f5f8f7] px-4 py-5 sm:px-6 sm:py-8">
      <main className="mx-auto w-full max-w-7xl">
        <div className="mb-5 flex items-center justify-between gap-4 lg:px-1">
          <Link href="/signup" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-brand-600">
            <span aria-hidden="true">←</span>
            Change account type
          </Link>
          <Link href="/login" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800">
            <span className="hidden sm:inline">Already have an account?&nbsp;</span>
            <span className="underline underline-offset-4">Log in</span>
          </Link>
        </div>

        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(560px,1.12fr)] lg:gap-7">
          <aside className="relative h-[350px] overflow-hidden rounded-[26px] bg-slate-900 text-white shadow-[0_18px_50px_rgba(15,23,42,0.16)] sm:h-[430px] lg:sticky lg:top-8 lg:h-[calc(100dvh-4rem)] lg:min-h-[680px] lg:max-h-[880px]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 42vw"
              className="object-cover"
              style={{ objectPosition: imagePosition }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,24,23,0.48)_0%,rgba(3,24,23,0.04)_38%,rgba(3,24,23,0.88)_100%)]" />

            <div className="absolute inset-x-0 top-0 p-5 sm:p-7">
              <div className="inline-flex items-center gap-2.5 rounded-xl bg-white/95 px-3 py-2 text-slate-950 shadow-sm backdrop-blur">
                <BrandLogo href="" size="sm" priority imageClassName="object-contain" />
                <div>
                  <p className="font-display text-sm font-extrabold leading-none">Anywork365</p>
                  <p className="mt-1 text-[10px] font-medium text-slate-500">Work. Talent. Opportunity.</p>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:p-9">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                <span className="flex h-6 w-6 items-center justify-center text-amber-300 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
                Register as {role}
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{eyebrow}</p>
              <h1 className="mt-2 max-w-lg font-display text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.6rem]">{title}</h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">{description}</p>

              <div className="mt-5 grid gap-2 border-t border-white/20 pt-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2 text-xs font-medium leading-relaxed text-white/90">
                    <span className="mt-0.5 text-amber-300">✓</span>
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)] sm:p-8 lg:p-10 xl:p-12">
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
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Create your account</p>
      <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">{description}</p>
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
