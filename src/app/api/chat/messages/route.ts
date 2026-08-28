/**
 * GET /api/chat/messages?conversationId=xxx
 * GET messages for a conversation
 * 
 * POST /api/chat/messages
 * Send a new message
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import { 
  getConversation, 
  sendMessage, 
  getMessages, 
  markMessagesAsRead,
  getUserConversations 
} from '@/lib/chat'
import {
  enrichChatConversation,
  enrichChatConversations,
  enrichChatMessages,
} from '@/lib/chat-enrichment'
import { findUserById } from '@/lib/users'
import { sendPushNotification } from '@/lib/notifications'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'

const sendSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  content: z.string().min(1, 'Message content is required').max(2000, 'Message too long'),
  type: z.enum(['text', 'image', 'file']).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getVerifiedSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const conversationId = req.nextUrl.searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    const conversation = await getConversation(conversationId)
    if (!conversation) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    if (!conversation.participants.includes(session.id)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Not authorized' },
        { status: 403 }
      )
    }

    await markMessagesAsRead(conversation, session.id)

    const messages = await getMessages(conversationId)
    const enrichedMessages = await enrichChatMessages(messages)
    const enrichedConversation = await enrichChatConversation(conversation, session.id)

    return NextResponse.json({
      success: true,
      data: { messages: enrichedMessages, conversation: enrichedConversation },
    })
  } catch (error) {
    console.error('Chat messages GET error:', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Messages are temporarily unavailable' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getVerifiedSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const rateLimit = checkRateLimit(`chat:${session.id}`, 20, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const body = await req.json().catch(() => null)
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { conversationId, content, type } = parsed.data

    const conversation = await getConversation(conversationId)
    if (!conversation) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    if (!conversation.participants.includes(session.id)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Not authorized' },
        { status: 403 }
      )
    }

    const message = await sendMessage(conversationId, session.id, content, type)

    const otherUserId = conversation.participants.find(p => p !== session.id)
    if (otherUserId) {
      const sender = await findUserById(session.id)
      sendPushNotification(
        otherUserId,
        `Message from ${sender?.firstName ?? 'Someone'}`,
        content.slice(0, 150),
        { type: 'chat', conversationId }
      ).catch(() => {})
    }

    const messages = await getMessages(conversationId)
    const enrichedMessages = await enrichChatMessages(messages)
    const conversations = await getUserConversations(session.id)
    const enrichedConversations = await enrichChatConversations(conversations, session.id)

    return NextResponse.json({
      success: true,
      data: { message, messages: enrichedMessages, conversations: enrichedConversations },
    })
  } catch (error) {
    console.error('Chat messages POST error:', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Your message could not be sent. Please try again.' },
      { status: 500 }
    )
  }
}
