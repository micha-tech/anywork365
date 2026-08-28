import { findUsersByIds } from '@/lib/users'
import type {
  ChatConversation,
  ChatMessage,
  ChatParticipantInfo,
  EnrichedChatConversation,
} from '@/types'

function participantInfo(
  userId: string,
  usersById: Map<string, Awaited<ReturnType<typeof findUsersByIds>>[number]>
): ChatParticipantInfo {
  const user = usersById.get(userId)
  return {
    id: userId,
    firstName: user?.firstName ?? 'User',
    lastName: user?.lastName ?? '',
    role: user?.role ?? 'artisan',
    avatarUrl: user?.avatarUrl,
    isVerified: user?.isVerified,
    city: user?.city,
  }
}

export async function enrichChatConversations(
  conversations: ChatConversation[],
  currentUserId: string
): Promise<EnrichedChatConversation[]> {
  const participantIds = Array.from(new Set(
    conversations.flatMap((conversation) =>
      conversation.participants.filter((participantId) => participantId !== currentUserId)
    )
  ))
  const users = await findUsersByIds(participantIds)
  const usersById = new Map(users.map((user) => [user.id, user]))

  return conversations.map((conversation) => {
    const participantsInfo: Record<string, ChatParticipantInfo> = {}
    for (const participantId of conversation.participants) {
      if (participantId === currentUserId) continue
      participantsInfo[participantId] = participantInfo(participantId, usersById)
    }
    return { ...conversation, participantsInfo }
  })
}

export async function enrichChatConversation(
  conversation: ChatConversation,
  currentUserId: string
): Promise<EnrichedChatConversation> {
  const [enriched] = await enrichChatConversations([conversation], currentUserId)
  return enriched
}

export async function enrichChatMessages(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const senderIds = Array.from(new Set(messages.map((message) => message.senderId)))
  const users = await findUsersByIds(senderIds)
  const usersById = new Map(users.map((user) => [user.id, user]))

  return messages.map((message) => ({
    ...message,
    senderInfo: usersById.has(message.senderId)
      ? participantInfo(message.senderId, usersById)
      : undefined,
  }))
}
