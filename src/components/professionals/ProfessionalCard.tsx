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
  const qualification = professional.qualification.trim()
  const bio = professional.bio?.trim()
  const hasRealBio = Boolean(bio && !/^lorem ipsum/i.test(bio) && !/dummy text/i.test(bio))
  const profileHref = `/professionals/${encodeURIComponent(professional.uid)}`
  const portfolioUrl = professional.linkedin_or_portfolio_url?.trim()
  const safePortfolioUrl = portfolioUrl && /^https?:\/\//i.test(portfolioUrl) ? portfolioUrl : null
  const experience = Number(professional.years_experience || 0)

  return (
    <article className="friendly-card-interactive group flex min-w-0 gap-4 p-4 sm:gap-5 sm:p-5">
      <Link href={profileHref} className="h-fit flex-shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20">
        <Avatar src={getAvatarUrl(professional.profile_image)} initials={initials} size="xl" colorIndex={index} className="h-16 w-16 text-xl sm:h-[72px] sm:w-[72px]" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={profileHref} className="inline-block max-w-full">
              <h2 className="truncate font-display text-base font-bold text-slate-950 transition-colors group-hover:text-brand-600 sm:text-lg">{name}</h2>
            </Link>
            <p className="mt-0.5 truncate text-sm font-medium text-brand-600">{jobTitle}</p>
          </div>
          <p className="flex max-w-[42%] flex-shrink-0 items-center gap-1 text-xs text-slate-500">
            <LocationIcon /><span className="truncate">{location}</span>
          </p>
        </div>

        <p className="mt-2 truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{industry} · {specialty}</p>
        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">
          {hasRealBio ? bio : `View ${name}'s professional background, experience and portfolio.`}
        </p>

        <div className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>{experience} year{experience === 1 ? '' : 's'} experience</span>
          {qualification && <span className="max-w-full truncate">{qualification}</span>}
        </div>

        <div className="mt-4 flex items-center gap-4">
          <Link href={profileHref} className="quiet-link -ml-3">View profile</Link>
          {safePortfolioUrl && (
            <a href={safePortfolioUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-slate-600 hover:text-brand-600">Portfolio ↗</a>
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
