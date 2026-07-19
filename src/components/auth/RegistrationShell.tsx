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
    <div className="min-h-dvh bg-[#f5f8f7]">
      <header className="flex min-h-[64px] items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 lg:hidden">
        <Link href="/" className="inline-flex min-w-0 items-center gap-2.5">
          <BrandLogo href="" size="sm" priority imageClassName="object-contain" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-extrabold leading-none text-slate-950">Anywork365</p>
            <p className="mt-1 truncate text-[10px] font-medium text-slate-500">Work. Talent. Opportunity.</p>
          </div>
        </Link>
        <Link href="/login" className="inline-flex min-h-[44px] flex-shrink-0 items-center px-1 text-sm font-semibold text-brand-700">
          Log in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-7xl lg:px-6 lg:py-8">
        <div className="flex min-h-[48px] items-center px-4 lg:hidden">
          <Link href="/signup" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-600">
            <span aria-hidden="true">←</span>
            Account types
          </Link>
        </div>

        <div className="mb-5 hidden items-center justify-between gap-4 px-1 lg:flex">
          <Link href="/signup" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-brand-600">
            <span aria-hidden="true">←</span>
            Change account type
          </Link>
          <Link href="/login" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800">
            <span className="hidden sm:inline">Already have an account?&nbsp;</span>
            <span className="underline underline-offset-4">Log in</span>
          </Link>
        </div>

        <section className="grid items-start sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(560px,1.12fr)] lg:gap-7 lg:px-0">
          <aside className="relative h-[260px] overflow-hidden bg-slate-900 text-white sm:h-[390px] sm:rounded-3xl sm:shadow-[0_18px_50px_rgba(15,23,42,0.14)] lg:sticky lg:top-8 lg:h-[calc(100dvh-4rem)] lg:min-h-[680px] lg:max-h-[880px]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 42vw"
              className="object-cover"
              style={{ objectPosition: imagePosition }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,24,23,0.12)_0%,rgba(3,24,23,0.04)_40%,rgba(3,24,23,0.88)_100%)] lg:bg-[linear-gradient(180deg,rgba(3,24,23,0.48)_0%,rgba(3,24,23,0.04)_38%,rgba(3,24,23,0.88)_100%)]" />

            <div className="absolute inset-x-0 top-0 hidden p-7 lg:block">
              <div className="inline-flex items-center gap-2.5 rounded-xl bg-white/95 px-3 py-2 text-slate-950 shadow-sm backdrop-blur">
                <BrandLogo href="" size="sm" priority imageClassName="object-contain" />
                <div>
                  <p className="font-display text-sm font-extrabold leading-none">Anywork365</p>
                  <p className="mt-1 text-[10px] font-medium text-slate-500">Work. Talent. Opportunity.</p>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-9">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-semibold backdrop-blur-md sm:mb-3 lg:mb-4">
                <span className="flex h-6 w-6 items-center justify-center text-amber-300 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
                Register as {role}
              </div>
              <p className="hidden text-xs font-bold uppercase tracking-[0.16em] text-amber-300 sm:block">{eyebrow}</p>
              <h1 className="max-w-lg font-display text-2xl font-extrabold leading-[1.1] tracking-tight sm:mt-2 sm:text-3xl lg:text-[2.6rem]">{title}</h1>
              <p className="mt-2 hidden max-w-lg text-sm leading-relaxed text-white/85 sm:block lg:mt-3 lg:text-base">{description}</p>

              <div className="mt-5 hidden gap-2 border-t border-white/20 pt-5 lg:grid lg:grid-cols-1 xl:grid-cols-3">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2 text-xs font-medium leading-relaxed text-white/90">
                    <span className="mt-0.5 text-amber-300">✓</span>
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="bg-white px-4 pb-8 pt-6 sm:mt-5 sm:rounded-3xl sm:border sm:border-slate-200/80 sm:p-8 sm:shadow-[0_18px_50px_rgba(15,23,42,0.07)] lg:mt-0 lg:p-10 xl:p-12">
            {children}
          </div>
        </section>
      </main>
    </div>
  )
}

export function RegistrationFormHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 border-b border-slate-100 pb-4 sm:mb-7 sm:pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Create your account</p>
      <h2 className="mt-2 font-display text-[1.65rem] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
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
