/**
 * GET /api/chat/conversations
 * Get user's conversations with participant info
 * 
 * POST /api/chat/conversations
 * Start or get a conversation with another user
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getOrCreateConversation, getUserConversations } from '@/lib/chat'
import { findUserById } from '@/lib/users'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse, ChatConversation } from '@/types'

const startSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

interface ParticipantInfo {
  id: string
  firstName: string
  lastName: string
  role: string
  avatarUrl?: string
  isVerified?: boolean
  city?: string
}

interface EnrichedConversation extends ChatConversation {
  participantsInfo: Record<string, ParticipantInfo>
}

async function enrichConversation(conv: ChatConversation, currentUserId: string): Promise<EnrichedConversation> {
  const participantsInfo: Record<string, ParticipantInfo> = {}
  for (const pid of conv.participants) {
    if (pid === currentUserId) continue
    const user = await findUserById(pid)
    participantsInfo[pid] = {
      id: pid,
      firstName: user?.firstName ?? 'User',
      lastName: user?.lastName ?? '',
      role: user?.role ?? 'vendor',
      avatarUrl: user?.avatarUrl,
      isVerified: user?.isVerified,
      city: user?.city,
    }
  }
  return { ...conv, participantsInfo }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const rateLimit = checkRateLimit(`chat:${session.id}`, 10, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.` },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }

  const body = await req.json()
  const parsed = startSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { userId } = parsed.data
  const conversation = getOrCreateConversation(session.id, userId)
  const enriched = await enrichConversation(conversation, session.id)

  return NextResponse.json({
    success: true,
    data: { conversation: enriched },
  })
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const conversations = getUserConversations(session.id)
    const enriched = await Promise.all(conversations.map(c => enrichConversation(c, session.id)))
    
    return NextResponse.json({
      success: true,
      data: { conversations: enriched },
    })
  } catch (error) {
    console.error('Chat conversations GET error:', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}