import Link from 'next/link'
import { Avatar } from '@/components/ui'
import { getAvatarUrl } from '@/lib/avatar'
import type { ProfessionalDirectoryRow } from '@/lib/queries'

interface ProfessionalCardProps {
  professional: ProfessionalDirectoryRow
  index?: number
}

export function ProfessionalCard({ professional, index = 0 }: ProfessionalCardProps) {
  const name = professional.full_name.trim() || 'Professional'
  const names = name.split(/\s+/)
  const initials = `${names[0]?.[0] || ''}${names[1]?.[0] || names[0]?.[1] || ''}`.toUpperCase()
  const location = [professional.lga, professional.state].filter(Boolean).join(', ') || 'Location not provided'
  const jobTitle = professional.job_title.trim() || 'Professional'
  const specialty = professional.professional_service_category.trim() || 'Professional services'
  const industry = professional.industry_category.trim() || 'Professional services'
  const qualification = professional.qualification.trim() || 'Qualification not listed'
  const bio = professional.bio?.trim()
  const hasRealBio = Boolean(bio && !/^lorem ipsum/i.test(bio) && !/dummy text/i.test(bio))
  const profileHref = `/professionals/${encodeURIComponent(professional.uid)}`
  const portfolioUrl = professional.linkedin_or_portfolio_url?.trim()
  const safePortfolioUrl = portfolioUrl && /^https?:\/\//i.test(portfolioUrl) ? portfolioUrl : null
  const experience = Number(professional.years_experience || 0)

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-lg">
      <div className="relative h-20 bg-[linear-gradient(120deg,#0F4F4A_0%,#1F6F68_72%,#D8A928_180%)] sm:h-24">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_80%_10%,white_0,transparent_36%)]" />
        <span className="absolute right-4 top-4 max-w-[62%] truncate rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          {industry}
        </span>
      </div>

      <div className="relative flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="-mt-9 mb-3 flex items-end justify-between gap-3 sm:-mt-10">
          <div className="rounded-full bg-white p-1 shadow-sm">
            <Avatar
              src={getAvatarUrl(professional.profile_image)}
              initials={initials}
              size="xl"
              colorIndex={index}
              className="h-16 w-16 border border-slate-100 text-xl sm:h-[72px] sm:w-[72px]"
            />
          </div>
          <p className="mb-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500">
            <LocationIcon />
            <span className="max-w-[150px] truncate">{location}</span>
          </p>
        </div>

        <div className="min-w-0">
          <Link href={profileHref} className="inline-block max-w-full">
            <h2 className="truncate font-display text-lg font-bold text-slate-950 transition-colors group-hover:text-brand-500 sm:text-xl">
              {name}
            </h2>
          </Link>
          <p className="mt-0.5 truncate text-sm font-semibold text-brand-600">{jobTitle}</p>
        </div>

        <div className="mt-3 min-w-0">
          <span className="inline-flex max-w-full rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
            <span className="truncate">{specialty}</span>
          </span>
        </div>

        <div className="my-4 grid grid-cols-2 divide-x divide-slate-200 rounded-xl border border-slate-100 bg-slate-50/80 py-2.5">
          <div className="flex min-w-0 items-center justify-center px-2 text-center text-sm">
            <span className="truncate font-bold text-slate-900">
              {experience} yr{experience === 1 ? '' : 's'} experience
            </span>
          </div>
          <div className="flex min-w-0 items-center justify-center px-2 text-center text-sm">
            <span className="truncate font-bold text-slate-900" title={qualification}>{qualification}</span>
          </div>
        </div>

        <p className="mb-4 line-clamp-2 min-h-[2.75rem] break-words text-sm leading-relaxed text-slate-600">
          {hasRealBio ? bio : `View ${name}'s profile for professional background, experience and portfolio.`}
        </p>

        <div className={`mt-auto grid gap-2 border-t border-slate-100 pt-4 ${safePortfolioUrl ? 'grid-cols-[minmax(0,1fr)_48px]' : 'grid-cols-1'}`}>
          <Link href={profileHref} className="btn-primary min-w-0 justify-between px-4 py-2.5 text-sm">
            <span>View profile</span>
            <ArrowIcon />
          </Link>
          {safePortfolioUrl && (
            <a
              href={safePortfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline h-11 min-w-0 px-0"
              aria-label={`Open ${name}'s LinkedIn or portfolio`}
              title="Open LinkedIn or portfolio"
            >
              <PortfolioIcon />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

function LocationIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0 text-brand-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9.69 18.933 10 19l.31-.067C12.83 17.72 17 13.983 17 9A7 7 0 1 0 3 9c0 4.983 4.17 8.72 6.69 9.933ZM10 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
    </svg>
  )
}

function PortfolioIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 3h7v7m0-7L10 14M5 7H3v14h14v-2M7 3h4" />
    </svg>
  )
}
