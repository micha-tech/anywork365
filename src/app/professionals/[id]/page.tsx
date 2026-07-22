import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Avatar, Badge } from '@/components/ui'
import { getAvatarUrl } from '@/lib/avatar'
import { getPortfolioByUid, getProfessionalProfileByUid } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function ProfessionalProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const professional = await getProfessionalProfileByUid(decodeURIComponent(id))
  if (!professional) notFound()
  const portfolio = await getPortfolioByUid(professional.uid)

  const names = professional.full_name.trim().split(/\s+/)
  const initials = `${names[0]?.[0] || ''}${names[1]?.[0] || names[0]?.[1] || ''}`.toUpperCase()
  const location = [professional.lga, professional.state].filter(Boolean).join(', ') || 'Nigeria'
  const headline = `${professional.job_title} · ${professional.professional_service_category}`
  const coverUrl = professional.cover_image_url && /^https?:\/\//i.test(professional.cover_image_url)
    ? professional.cover_image_url
    : null
  const portfolioUrl = professional.linkedin_or_portfolio_url && /^https?:\/\//i.test(professional.linkedin_or_portfolio_url)
    ? professional.linkedin_or_portfolio_url
    : null

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/professionals" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
          <span aria-hidden="true">←</span> Back to professionals
        </Link>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-28 overflow-hidden bg-[linear-gradient(120deg,#064e3b_0%,#0f766e_50%,#2dd4bf_100%)] sm:h-44">
            {coverUrl && (
              <Image
                src={coverUrl}
                alt={`${professional.full_name}'s profile cover`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
                unoptimized
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
          </div>
          <div className="relative px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-12 sm:-mt-16">
              <Avatar
                src={getAvatarUrl(professional.profile_image)}
                initials={initials}
                size="xl"
                className="h-24 w-24 border-4 border-white text-2xl shadow-md sm:h-32 sm:w-32 sm:text-3xl"
              />
            </div>

            <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{professional.full_name}</h1>
                <p className="mt-1 max-w-3xl text-base font-medium leading-6 text-slate-700 sm:text-lg">{headline}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                  <LocationIcon /> {location}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="green">{professional.industry_category}</Badge>
                  <Badge variant="gray">{professional.years_experience} years experience</Badge>
                </div>
              </div>

              {portfolioUrl && (
                <a
                  href={portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex w-full justify-center px-5 py-2.5 text-sm sm:w-auto"
                >
                  View LinkedIn or portfolio
                </a>
              )}
            </div>
          </div>
        </section>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.75fr)]">
          <div className="space-y-4">
            <ProfileSection title="About">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600 sm:text-base">
                {professional.bio || `${professional.full_name} is a ${professional.job_title.toLowerCase()} specialising in ${professional.professional_service_category.toLowerCase()}.`}
              </p>
            </ProfileSection>

            <ProfileSection title="Experience">
              <div className="flex gap-4">
                <SectionIcon type="experience" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{professional.job_title}</h3>
                  <p className="mt-0.5 text-sm text-slate-600">{professional.professional_service_category}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {professional.years_experience} {professional.years_experience === 1 ? 'year' : 'years'} of professional experience
                  </p>
                </div>
              </div>
            </ProfileSection>

            <ProfileSection title="Education">
              <div className="flex gap-4">
                <SectionIcon type="education" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{professional.qualification}</h3>
                  <p className="mt-1 text-sm text-slate-500">Professional qualification</p>
                </div>
              </div>
            </ProfileSection>

            {portfolio.length > 0 && (
              <ProfileSection title="Portfolio">
                <div className="grid gap-4 sm:grid-cols-2">
                  {portfolio.map((item) => {
                    const projectUrl = item.projectUrl && /^https?:\/\//i.test(item.projectUrl) ? item.projectUrl : null
                    return (
                      <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            width={720}
                            height={480}
                            className="aspect-[3/2] w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-[3/2] items-center justify-center bg-[linear-gradient(135deg,#ecfdf5_0%,#ccfbf1_100%)] px-6 text-center font-display text-lg font-semibold text-brand-800">
                            {item.title}
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="font-semibold text-slate-900">{item.title}</h3>
                          {item.description && <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>}
                          {projectUrl && (
                            <a href={projectUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700">
                              View project →
                            </a>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </ProfileSection>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <ProfileSection title="Expertise">
              <div className="flex flex-wrap gap-2">
                <Badge variant="green">{professional.professional_service_category}</Badge>
                <Badge variant="gray">{professional.industry_category}</Badge>
                <Badge variant="gray">{professional.job_title}</Badge>
              </div>
            </ProfileSection>

            <ProfileSection title="Profile details">
              <dl className="space-y-4 text-sm">
                <ProfileDetail label="Current role" value={professional.job_title} />
                <ProfileDetail label="Industry" value={professional.industry_category} />
                <ProfileDetail label="Specialty" value={professional.professional_service_category} />
                <ProfileDetail label="Location" value={location} />
                <ProfileDetail label="Experience" value={`${professional.years_experience} years`} />
              </dl>
            </ProfileSection>
          </aside>
        </div>
      </div>
    </main>
  )
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-semibold text-slate-900 sm:text-xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 font-medium leading-5 text-slate-700">{value}</dd>
    </div>
  )
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function SectionIcon({ type }: { type: 'experience' | 'education' }) {
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
      {type === 'experience' ? (
        <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
        </svg>
      ) : (
        <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 10 9-5 9 5-9 5-9-5Z" />
          <path d="M7 12.5V17c3 2 7 2 10 0v-4.5M21 10v6" />
        </svg>
      )}
    </div>
  )
}
