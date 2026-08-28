/**
 * GET /api/chat/conversations
 * Get user's conversations with participant info
 * 
 * POST /api/chat/conversations
 * Start or get a conversation with another user
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import { getOrCreateConversation, getUserConversations } from '@/lib/chat'
import { enrichChatConversation, enrichChatConversations } from '@/lib/chat-enrichment'
import { findUserById } from '@/lib/users'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'

const startSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getVerifiedSession()
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

    const body = await req.json().catch(() => null)
    const parsed = startSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { userId } = parsed.data
    if (userId === session.id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'You cannot start a conversation with yourself' },
        { status: 400 }
      )
    }
    const targetUser = await findUserById(userId)
    if (!targetUser) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'This user is no longer available' },
        { status: 404 }
      )
    }
    const conversation = await getOrCreateConversation(session.id, userId)
    const enriched = await enrichChatConversation(conversation, session.id)

    return NextResponse.json({
      success: true,
      data: { conversation: enriched },
    })
  } catch (error) {
    console.error('Chat conversations POST error:', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Chat is temporarily unavailable' },
      { status: 500 }
    )
  }
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getVerifiedSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const conversations = await getUserConversations(session.id)
    const enriched = await enrichChatConversations(conversations, session.id)
    
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
