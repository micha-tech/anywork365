import Link from 'next/link'
import { BrandLogo } from '@/components/layout/BrandLogo'

const accountTypes = [
  {
    href: '/signup/client',
    title: 'Client',
    description: 'Hire trusted people and manage work from one place.',
    icon: ClientIcon,
    accent: 'bg-brand-50 text-brand-600 group-hover:bg-brand-500 group-hover:text-white',
  },
  {
    href: '/signup/artisan',
    title: 'Artisan',
    description: 'Offer skilled, hands-on services and get discovered locally.',
    icon: ArtisanIcon,
    accent: 'bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white',
  },
  {
    href: '/signup/professional',
    title: 'Professional',
    description: 'Showcase your expertise and access career opportunities.',
    icon: ProfessionalIcon,
    accent: 'bg-sky-50 text-sky-600 group-hover:bg-sky-500 group-hover:text-white',
  },
  {
    href: '/signup/recruiter',
    title: 'Recruiter',
    description: 'Find qualified talent and recruit for your organisation.',
    icon: RecruiterIcon,
    accent: 'bg-violet-50 text-violet-600 group-hover:bg-violet-500 group-hover:text-white',
  },
] as const

export default function SignupPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-brand-900 px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <main className="relative mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-6xl items-center justify-center sm:min-h-[calc(100dvh-5rem)]">
        <section className="grid w-full overflow-hidden rounded-[28px] border border-white/15 bg-white shadow-[0_32px_90px_rgba(0,0,0,0.28)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#0F4F4A_0%,#062d2b_62%,#041f1e_100%)] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
            <div className="absolute -right-16 top-28 h-56 w-56 rounded-full border border-white/10" />
            <div className="absolute -right-3 top-40 h-32 w-32 rounded-full border border-amber-300/25" />

            <div className="relative flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg">
                <BrandLogo href="" size="md" priority imageClassName="object-contain" />
              </span>
              <div>
                <p className="font-display text-xl font-extrabold tracking-tight">Anywork365</p>
                <p className="text-xs font-medium text-brand-200">Work. Talent. Opportunity.</p>
              </div>
            </div>

            <div className="relative max-w-md py-12">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-amber-300 backdrop-blur">
                One platform, built around you
              </span>
              <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight xl:text-5xl">
                Start with the account that fits your goals.
              </h1>
              <p className="mt-5 max-w-sm text-base leading-relaxed text-brand-100">
                Whether you need work done, offer a skill, build a career, or hire talent, your experience begins here.
              </p>
            </div>

            <div className="relative grid grid-cols-2 gap-3 text-sm text-brand-100">
              {['Trusted connections', 'Secure platform', 'Built for Nigeria', 'Opportunities daily'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-amber-300">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfb_100%)] p-5 sm:p-8 lg:p-10 xl:p-12">
            <div className="mb-7 flex items-center justify-center gap-3 lg:hidden">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_10px_30px_rgba(15,79,74,0.14)] ring-1 ring-brand-100">
                <BrandLogo href="" size="md" priority imageClassName="object-contain" />
              </span>
              <div>
                <p className="font-display text-xl font-extrabold text-brand-900">Anywork365</p>
                <p className="text-xs font-semibold text-brand-500">Work. Talent. Opportunity.</p>
              </div>
            </div>

            <div className="mx-auto max-w-xl">
              <div className="text-center lg:text-left">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Create your account</p>
                <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Register as</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
                  Choose the option that best describes how you want to use Anywork365.
                </p>
              </div>

              <div className="mt-7 space-y-3">
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
