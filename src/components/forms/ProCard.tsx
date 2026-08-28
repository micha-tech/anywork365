'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar, Stars, VerifiedBusinessBadge } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import type { User } from '@/types'

interface ProCardProps {
  pro: User
  index?: number
}

export function ProCard({ pro, index = 0 }: ProCardProps) {
  const router = useRouter()
  const [startingChat, setStartingChat] = useState(false)
  const initials = getInitials(pro.firstName, pro.lastName)
  const ownerName = `${pro.firstName} ${pro.lastName}`.trim()
  const displayName = pro.businessName?.trim() || ownerName
  const showOwnerName = Boolean(pro.businessName?.trim() && ownerName && ownerName.toLowerCase() !== pro.businessName.trim().toLowerCase())
  const location = [pro.lga, pro.city].filter(Boolean).join(', ') || 'Location not provided'
  const primarySkill = pro.skills?.[0] || 'Artisan services'
  const bio = pro.bio?.trim()
  const hasRealBio = Boolean(bio && !/^lorem ipsum/i.test(bio) && !/dummy text/i.test(bio))

  async function handleStartChat() {
    if (startingChat) return
    setStartingChat(true)
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pro.id }),
      })
      const data = await res.json()
      if (data.success) router.push(`/messages?id=${data.data.conversation.id}`)
      else toast.error(data.error || 'Failed to start chat')
    } catch {
      toast.error('Failed to start chat')
    } finally {
      setStartingChat(false)
    }
  }

  return (
    <article className="friendly-card-interactive group flex min-w-0 gap-4 p-4 sm:gap-5 sm:p-5">
      <Link href={`/artisans/${pro.id}`} className="relative h-fit flex-shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20">
        <Avatar src={pro.avatarUrl} initials={initials} size="xl" colorIndex={index} className="h-16 w-16 text-xl sm:h-[72px] sm:w-[72px]" />
        {pro.isVerified && <VerifiedBusinessBadge label={false} size="sm" className="absolute bottom-0 right-0 border-2 border-white" />}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/artisans/${pro.id}`} className="inline-block max-w-full">
              <h2 className="truncate font-display text-base font-bold text-slate-950 transition-colors group-hover:text-brand-600 sm:text-lg">{displayName}</h2>
            </Link>
            <p className="mt-0.5 truncate text-sm font-medium text-brand-600">{primarySkill}</p>
          </div>
          <p className="flex max-w-[42%] flex-shrink-0 items-center gap-1 text-xs text-slate-500">
            <LocationIcon /><span className="truncate">{location}</span>
          </p>
        </div>

        {showOwnerName && <p className="mt-1 truncate text-xs text-slate-500">Run by {ownerName}</p>}

        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">
          {hasRealBio ? bio : `View services, availability and contact details for ${displayName}.`}
        </p>

        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
          {Number(pro.reviewCount || 0) > 0 ? (
            <Stars rating={Number(pro.rating || 0)} count={pro.reviewCount} />
          ) : (
            <span>New on Anywork365</span>
          )}
          {pro.yearsOfExperience !== undefined && (
            <span>{pro.yearsOfExperience} year{pro.yearsOfExperience === 1 ? '' : 's'} experience</span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Link href={`/artisans/${pro.id}`} className="quiet-link -ml-3">View profile</Link>
          <button
            type="button"
            onClick={handleStartChat}
            disabled={startingChat}
            className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50"
          >
            {startingChat ? 'Opening chat…' : 'Message'}
          </button>
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
