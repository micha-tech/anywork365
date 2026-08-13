'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar, VerifiedBusinessBadge } from '@/components/ui'
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
  const rating = Number(pro.rating || 0)
  const reviews = Number(pro.reviewCount || 0)

  async function handleStartChat(e: React.MouseEvent) {
    e.preventDefault()
    if (startingChat) return

    setStartingChat(true)
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pro.id }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/messages?id=${data.data.conversation.id}`)
      } else {
        toast.error(data.error || 'Failed to start chat')
      }
    } catch {
      toast.error('Failed to start chat')
    } finally {
      setStartingChat(false)
    }
  }

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-lg">
      <div className="relative h-20 bg-[linear-gradient(120deg,#0F4F4A_0%,#1F6F68_72%,#D8A928_180%)] sm:h-24">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_80%_10%,white_0,transparent_36%)]" />
        <span className="absolute right-4 top-4 max-w-[60%] truncate rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          {primarySkill}
        </span>
      </div>

      <div className="relative flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="-mt-9 mb-3 flex items-end justify-between gap-3 sm:-mt-10">
          <div className="relative rounded-full bg-white p-1 shadow-sm">
            <Avatar
              src={pro.avatarUrl}
              initials={initials}
              size="xl"
              colorIndex={index}
              className="h-16 w-16 border border-slate-100 text-xl sm:h-[72px] sm:w-[72px]"
            />
            {pro.isVerified && (
              <VerifiedBusinessBadge label={false} className="absolute bottom-1 right-0 border-2 border-white shadow-sm" />
            )}
          </div>

          <p className="mb-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500">
            <LocationIcon />
            <span className="max-w-[150px] truncate">{location}</span>
          </p>
        </div>

        <div className="min-w-0">
          <Link href={`/artisans/${pro.id}`} className="inline-block max-w-full">
            <h2 className="truncate font-display text-lg font-bold text-slate-950 transition-colors group-hover:text-brand-500 sm:text-xl">
              {displayName}
            </h2>
          </Link>
          {showOwnerName && <p className="mt-0.5 truncate text-xs text-slate-500">Run by {ownerName}</p>}
        </div>

        <div className="my-4 grid grid-cols-2 divide-x divide-slate-200 rounded-xl border border-slate-100 bg-slate-50/80 py-2.5">
          <div className="flex min-w-0 items-center justify-center gap-1.5 px-2 text-sm">
            <StarIcon />
            {reviews > 0 ? (
              <>
                <span className="font-bold text-slate-900">{rating.toFixed(1)}</span>
                <span className="truncate text-xs text-slate-500">({reviews})</span>
              </>
            ) : (
              <span className="font-semibold text-slate-600">New</span>
            )}
          </div>
          <div className="flex min-w-0 items-center justify-center px-2 text-sm">
            <span className="truncate font-bold text-slate-900">
              {pro.yearsOfExperience !== undefined
                ? `${pro.yearsOfExperience} yr${pro.yearsOfExperience === 1 ? '' : 's'} experience`
                : 'Experience not listed'}
            </span>
          </div>
        </div>

        <p className="mb-4 line-clamp-2 min-h-[2.75rem] break-words text-sm leading-relaxed text-slate-600">
          {hasRealBio ? bio : `View ${displayName}'s profile for services, availability and contact details.`}
        </p>

        <div className="mt-auto grid grid-cols-[minmax(0,1fr)_48px] gap-2 border-t border-slate-100 pt-4">
          <Link href={`/artisans/${pro.id}`} className="btn-primary min-w-0 justify-between px-4 py-2.5 text-sm">
            <span>View profile</span>
            <ArrowIcon />
          </Link>
          <button
            type="button"
            onClick={handleStartChat}
            disabled={startingChat}
            className="btn-outline h-11 min-w-0 px-0 disabled:opacity-50"
            aria-label={startingChat ? 'Starting chat' : `Message ${displayName}`}
            title={`Message ${displayName}`}
          >
            {startingChat ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            ) : (
              <MessageIcon />
            )}
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

function StarIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 0 0 .95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 0 0-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 0 0-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 0 0-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 0 0 .95-.69l1.07-3.29Z" />
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

function MessageIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5m8-2a9 9 0 0 1-13.62 7.72L3 21l1.28-4.38A9 9 0 1 1 21 12Z" />
    </svg>
  )
}
