'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Avatar, Badge, Stars } from '@/components/ui'
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
        alert(data.error || 'Failed to start chat')
      }
    } catch {
      alert('Failed to start chat. Please try again.')
    } finally {
      setStartingChat(false)
    }
  }

  return (
    <div className="card hover:border-brand-500 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group">
      <div className="relative">
        <Avatar
          initials={initials}
          size="lg"
          colorIndex={index}
          className="mb-4"
        />
        {pro.isVerified && (
          <div className="absolute -bottom-1 left-6 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          </div>
        )}
      </div>

      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-medium text-slate-900 group-hover:text-brand-500 transition-colors">
          {pro.firstName} {pro.lastName}
        </h3>
        {pro.isVerified && (
          <span className="text-xs text-blue-500 font-medium">Verified</span>
        )}
      </div>
      <p className="text-sm text-slate-500 mt-0.5">
        {pro.skills?.[0]} · {pro.city}
      </p>

      {pro.rating && (
        <div className="my-2">
          <Stars rating={pro.rating} count={pro.reviewCount} />
        </div>
      )}

      {pro.skills && pro.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 my-3">
          {pro.skills.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="green">{skill}</Badge>
          ))}
        </div>
      )}

      {pro.bio && (
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-4">
          {pro.bio}
        </p>
      )}

      <div className="flex gap-2 pt-2 border-t border-slate-200">
        <Link
          href={`/professionals/${pro.id}`}
          className="btn-primary text-xs px-3 py-1.5 flex-1 text-center"
        >
          View Profile
        </Link>
        <button
          onClick={handleStartChat}
          disabled={startingChat}
          className="btn-ghost text-xs px-3 py-1.5 flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {startingChat ? (
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </>
          )}
        </button>
      </div>
    </div>
  )
}