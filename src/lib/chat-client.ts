import type { ChatMessage, EnrichedChatConversation } from '@/types'

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error?: string }

export class ChatClientError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'ChatClientError'
  }
}

function errorMessage(status: number, serverMessage?: string): string {
  if (status === 400 && serverMessage) return serverMessage
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You no longer have access to this conversation.'
  if (status === 404) return 'This conversation is no longer available.'
  if (status === 429) return 'Chat is busy right now. Please wait a moment and try again.'
  if (status >= 500) return 'Messages are temporarily unavailable. Please try again shortly.'
  return serverMessage || 'We couldn’t complete that chat request.'
}

async function requestChat<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(input, {
      cache: 'no-store',
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    })
  } catch {
    throw new ChatClientError('We couldn’t connect to chat. Check your connection and try again.')
  }

  const text = await response.text()
  let payload: ApiEnvelope<T> | null = null
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>
    } catch {
      throw new ChatClientError(errorMessage(response.status || 500), response.status)
    }
  }

  if (!response.ok || !payload || payload.success !== true) {
    const serverMessage = payload && 'error' in payload ? payload.error : undefined
    throw new ChatClientError(errorMessage(response.status || 500, serverMessage), response.status)
  }

  return payload.data
}

export async function getChatConversations(): Promise<EnrichedChatConversation[]> {
  const data = await requestChat<{ conversations: EnrichedChatConversation[] }>(
    '/api/chat/conversations'
  )
  return data.conversations
}

export async function getChatMessages(conversationId: string): Promise<ChatMessage[]> {
  const data = await requestChat<{ messages: ChatMessage[] }>(
    `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`
  )
  return data.messages
}

export async function sendChatMessage(
  conversationId: string,
  content: string
): Promise<ChatMessage[]> {
  const data = await requestChat<{ messages: ChatMessage[] }>('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, content }),
  })
  return data.messages
}

export async function startChatConversation(userId: string): Promise<EnrichedChatConversation> {
  const data = await requestChat<{ conversation: EnrichedChatConversation }>(
    '/api/chat/conversations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }
  )
  return data.conversation
}

export function getChatErrorMessage(error: unknown): string {
  return error instanceof ChatClientError
    ? error.message
    : 'Messages are temporarily unavailable. Please try again shortly.'
}
