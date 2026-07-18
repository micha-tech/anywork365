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
  const location = [pro.lga, pro.city].filter(Boolean).join(', ')
  const primarySkill = pro.skills?.[0] || 'Service provider'
  const displayName = pro.businessName || `${pro.firstName} ${pro.lastName}`.trim()
  const bio = pro.bio?.trim()
  const hasRealBio = Boolean(bio && !/^lorem ipsum/i.test(bio) && !/dummy text/i.test(bio))

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
    <article className="card group flex h-full min-w-0 flex-col p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-md sm:p-5">
      <div className="mb-3 flex min-w-0 items-start gap-3">
        <div className="relative flex-shrink-0">
          <Avatar src={pro.avatarUrl} initials={initials} size="lg" colorIndex={index} className="h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg" />
          {pro.isVerified && (
            <VerifiedBusinessBadge label={false} className="absolute -bottom-1 -right-1 border-2 border-white shadow-sm" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex min-w-0 items-center gap-1.5">
            <Link href={`/artisans/${pro.id}`} className="truncate font-semibold text-slate-900 transition-colors group-hover:text-brand-500">
              {displayName}
            </Link>
          </div>
          {location && <p className="line-clamp-1 text-sm text-slate-500">{location}</p>}
        </div>
      </div>

      <div className="mb-3 min-w-0">
        <span className="inline-flex max-w-full items-center rounded-md border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600">
          <span className="truncate">{primarySkill}</span>
        </span>
      </div>

      {hasRealBio && (
        <p className="mb-4 line-clamp-2 break-words text-sm leading-relaxed text-slate-500">
          {bio}
        </p>
      )}

      <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-slate-100 pt-3">
        <Link
          href={`/artisans/${pro.id}`}
          className="btn-primary min-w-0 px-3 py-2 text-xs"
        >
          Book
        </Link>
        <button
          onClick={handleStartChat}
          disabled={startingChat}
          className="btn-ghost min-w-[44px] px-3 py-2 text-xs disabled:opacity-50"
          aria-label={startingChat ? 'Starting chat' : `Message ${displayName}`}
        >
          {startingChat ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden min-[360px]:inline">Message</span>
            </>
          )}
        </button>
      </div>
    </article>
  )
}
