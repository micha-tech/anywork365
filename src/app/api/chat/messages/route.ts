/**
 * GET /api/chat/messages?conversationId=xxx
 * GET messages for a conversation
 * 
 * POST /api/chat/messages
 * Send a new message
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { 
  getConversation, 
  sendMessage, 
  getMessages, 
  markMessagesAsRead,
  getUserConversations 
} from '@/lib/chat'
import { findUserById } from '@/lib/users'
import { sendPushNotification } from '@/lib/notifications'
import type { ApiResponse, ChatParticipantInfo } from '@/types'

const sendSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  content: z.string().min(1, 'Message content is required').max(2000, 'Message too long'),
  type: z.enum(['text', 'image', 'file']).optional(),
})

async function enrichMessage(msg: ReturnType<typeof getMessages>[number]) {
  const sender = await findUserById(msg.senderId)
  const senderInfo: ChatParticipantInfo | undefined = sender ? {
    id: sender.id,
    firstName: sender.firstName,
    lastName: sender.lastName,
    role: sender.role,
    avatarUrl: sender.avatarUrl,
    isVerified: sender.isVerified,
    city: sender.city,
  } : undefined
  return { ...msg, senderInfo }
}

async function enrichConversation(conv: ReturnType<typeof getUserConversations>[number], currentUserId: string) {
  const participantsInfo: Record<string, ChatParticipantInfo> = {}
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

export async function GET(req: NextRequest) {
  const session = await getSession()
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

  const conversation = getConversation(conversationId)
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

  markMessagesAsRead(conversationId, session.id)

  const messages = getMessages(conversationId)
  const enrichedMessages = await Promise.all(messages.map(enrichMessage))
  const enrichedConversation = await enrichConversation(conversation, session.id)

  return NextResponse.json({
    success: true,
    data: { messages: enrichedMessages, conversation: enrichedConversation },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const body = await req.json()
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { conversationId, content, type } = parsed.data

  const conversation = getConversation(conversationId)
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

  const message = sendMessage(conversationId, session.id, content, type)

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

  const messages = getMessages(conversationId)
  const enrichedMessages = await Promise.all(messages.map(enrichMessage))
  const conversations = getUserConversations(session.id)
  const enrichedConversations = await Promise.all(conversations.map(c => enrichConversation(c, session.id)))

  return NextResponse.json({
    success: true,
    data: { message, messages: enrichedMessages, conversations: enrichedConversations },
  })
}