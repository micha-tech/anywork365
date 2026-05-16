import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import type { ChatConversation, ChatMessage, ChatNotification, PushSubscription } from '@/types'

const raw = process.env.CHAT_ENCRYPTION_KEY
if (!raw) {
  throw new Error('Missing CHAT_ENCRYPTION_KEY environment variable. Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"')
}
const CHAT_KEY = Buffer.from(raw, 'base64')
if (CHAT_KEY.length !== 32) {
  throw new Error('CHAT_ENCRYPTION_KEY must be a 32-byte base64 string')
}

function encryptMessage(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', CHAT_KEY.slice(0, 32), iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decryptMessage(encrypted: string): string {
  try {
    const [ivHex, authTagHex, content] = encrypted.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = createDecipheriv('aes-256-gcm', CHAT_KEY.slice(0, 32), iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(content, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch {
    return '[Unable to decrypt message]'
  }
}

// ─── SSE Event Emitter ───────────────────────────────────────────────

type EventCallback = (data: unknown) => void
const sseClients = new Map<string, Set<EventCallback>>()

export function registerSSEClient(userId: string, callback: EventCallback) {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set())
  }
  sseClients.get(userId)!.add(callback)
}

export function unregisterSSEClient(userId: string, callback: EventCallback) {
  const clientSet = sseClients.get(userId)
  if (clientSet) {
    clientSet.delete(callback)
    if (clientSet.size === 0) {
      sseClients.delete(userId)
    }
  }
}

function emitToUser(userId: string, event: string, data: unknown) {
  const clientSet = sseClients.get(userId)
  if (clientSet) {
    clientSet.forEach(callback => callback({ event, data }))
  }
}

function emitConversationUpdate(userId: string, conversations: ChatConversation[]) {
  emitToUser(userId, 'conversation_update', { conversations })
}

function emitMessageUpdate(userId: string, conversationId: string, messages: ChatMessage[]) {
  emitToUser(userId, 'message_update', { conversationId, messages })
}

// ─── In-memory stores ─────────────────────────────────────────────────

const conversationStore = new Map<string, ChatConversation>()
const messageStore = new Map<string, ChatMessage>()
const notificationStore = new Map<string, ChatNotification>()
const pushSubscriptionStore = new Map<string, PushSubscription[]>()

// ─── Conversations ─────────────────────────────────────────────────

export function getOrCreateConversation(userId1: string, userId2: string): ChatConversation {
  const existing = Array.from(conversationStore.values())
    .find(c => c.participants.includes(userId1) && c.participants.includes(userId2))
  
  if (existing) return existing
  
  const conversation: ChatConversation = {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    participants: [userId1, userId2].sort(),
    unreadCount: { [userId1]: 0, [userId2]: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  conversationStore.set(conversation.id, conversation)
  return conversation
}

export function getConversation(conversationId: string): ChatConversation | undefined {
  return conversationStore.get(conversationId)
}

export function getUserConversations(userId: string): ChatConversation[] {
  return Array.from(conversationStore.values())
    .filter(c => c.participants.includes(userId))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// ─── Messages ─────────────────────────────────────────────────

export function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: 'text' | 'image' | 'file' = 'text'
): ChatMessage {
  const conversation = conversationStore.get(conversationId)
  if (!conversation) throw new Error('Conversation not found')
  
  const encryptedContent = encryptMessage(content)
  
  const message: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversationId,
    senderId,
    content: encryptedContent,
    type,
    status: 'sent',
    createdAt: new Date().toISOString(),
  }
  
  messageStore.set(message.id, message)
  
  conversation.lastMessage = content.slice(0, 50)
  conversation.lastMessageAt = message.createdAt
  conversation.updatedAt = message.createdAt
  
  const otherUser = conversation.participants.find(p => p !== senderId)
  if (otherUser) {
    conversation.unreadCount[otherUser] = (conversation.unreadCount[otherUser] ?? 0) + 1
  }
  
  conversationStore.set(conversationId, conversation)
  
  if (otherUser) {
    createNotification(otherUser, {
      type: 'message',
      title: 'New Message',
      body: content.slice(0, 100),
      conversationId,
    })
    
    const otherConversations = getUserConversations(otherUser)
    emitConversationUpdate(otherUser, otherConversations)
  }

  const senderConversations = getUserConversations(senderId)
  emitConversationUpdate(senderId, senderConversations)
  
  return message
}

export function getMessages(conversationId: string): ChatMessage[] {
  const messages = Array.from(messageStore.values())
    .filter(m => m.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  
  // Decrypt messages for display
  return messages.map(m => ({
    ...m,
    contentDecrypted: decryptMessage(m.content),
  }))
}

export function markMessagesAsRead(conversationId: string, userId: string): void {
  const conversation = conversationStore.get(conversationId)
  if (conversation) {
    conversation.unreadCount[userId] = 0
    conversationStore.set(conversationId, conversation)
  }
  
  // Mark all messages as read
  Array.from(messageStore.values())
    .filter(m => m.conversationId === conversationId && m.senderId !== userId)
    .forEach(m => {
      m.status = 'read'
      messageStore.set(m.id, m)
    })
}

// ─── Notifications ──────────────────────────────────────────────

export function createNotification(
  userId: string,
  data: {
    type: ChatNotification['type']
    title: string
    body: string
    conversationId?: string
  }
): ChatNotification {
  const notification: ChatNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    type: data.type,
    title: data.title,
    body: data.body,
    conversationId: data.conversationId,
    isRead: false,
    createdAt: new Date().toISOString(),
  }
  
  notificationStore.set(notification.id, notification)
  return notification
}

export function getUserNotifications(userId: string): ChatNotification[] {
  return Array.from(notificationStore.values())
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getUnreadNotificationCount(userId: string): number {
  return Array.from(notificationStore.values())
    .filter(n => n.userId === userId && !n.isRead)
    .length
}

export function markNotificationAsRead(notificationId: string): void {
  const notification = notificationStore.get(notificationId)
  if (notification) {
    notification.isRead = true
    notificationStore.set(notificationId, notification)
  }
}

export function markAllNotificationsAsRead(userId: string): void {
  Array.from(notificationStore.values())
    .filter(n => n.userId === userId && !n.isRead)
    .forEach(n => {
      n.isRead = true
      notificationStore.set(n.id, n)
    })
}

// ─── Push Subscriptions ───────────────────────────────────────────

export function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): PushSubscription {
  const existing = pushSubscriptionStore.get(userId) ?? []
  const sub: PushSubscription = {
    id: `push-${Date.now()}`,
    userId,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    createdAt: new Date().toISOString(),
  }
  
  existing.push(sub)
  pushSubscriptionStore.set(userId, existing)
  
  return sub
}

export function getUserPushSubscriptions(userId: string): PushSubscription[] {
  return pushSubscriptionStore.get(userId) ?? []
}

export function removePushSubscription(userId: string, endpoint: string): void {
  const existing = pushSubscriptionStore.get(userId) ?? []
  const filtered = existing.filter(s => s.endpoint !== endpoint)
  pushSubscriptionStore.set(userId, filtered)
}