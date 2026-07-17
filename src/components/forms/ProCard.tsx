'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar, Badge, Stars, VerifiedBusinessBadge } from '@/components/ui'
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
  const rating = pro.rating || 0

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
    <article className="card group flex h-full flex-col hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-md transition-all duration-200">
      <div className="mb-4 flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <Avatar initials={initials} size="lg" colorIndex={index} />
          {pro.isVerified && (
            <VerifiedBusinessBadge label={false} className="absolute -bottom-1 -right-1 border-2 border-white shadow-sm" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Link href={`/professionals/${pro.id}`} className="truncate font-semibold text-slate-900 transition-colors group-hover:text-brand-500">
              {pro.firstName} {pro.lastName}
            </Link>
            {pro.isVerified && <VerifiedBusinessBadge size="sm" />}
          </div>
          <p className="truncate text-sm text-slate-500">{primarySkill}</p>
          {location && <p className="mt-0.5 truncate text-xs text-slate-400">{location}</p>}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          {rating > 0 ? <Stars rating={rating} count={pro.reviewCount} /> : <span className="text-xs font-medium text-slate-500">New vendor</span>}
        </div>
        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Available
        </span>
      </div>

      {pro.skills && pro.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 my-3">
          {pro.skills.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="green">{skill}</Badge>
          ))}
        </div>
      )}

      {pro.bio && (
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-slate-500">
          {pro.bio}
        </p>
      )}

      <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
        <Link
          href={`/professionals/${pro.id}`}
          className="btn-primary flex-1 px-3 py-2 text-xs"
        >
          Book
        </Link>
        <button
          onClick={handleStartChat}
          disabled={startingChat}
          className="btn-ghost px-3 py-2 text-xs disabled:opacity-50"
        >
          {startingChat ? (
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Message
            </>
          )}
        </button>
      </div>
    </article>
  )
}
