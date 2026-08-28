import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import type { RowDataPacket } from 'mysql2/promise'
import { execute, query, queryOne } from '@/lib/db'
import type { ChatConversation, ChatMessage, ChatNotification, PushSubscription } from '@/types'

let _chatKey: Buffer | null = null
let _tablesReady: Promise<void> | null = null

interface ChatConversationRow extends RowDataPacket {
  id: string
  user1: string
  user2: string
  last_message: string | null
  last_message_at: Date | string | null
  unread_json: string | null
  created_at: Date | string
  updated_at: Date | string
}

interface ChatMessageRow extends RowDataPacket {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'file'
  status: 'sent' | 'delivered' | 'read'
  created_at: Date | string
}

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function getChatKey(): Buffer {
  if (_chatKey) return _chatKey
  const raw = process.env.CHAT_ENCRYPTION_KEY
  if (raw) {
    const key = Buffer.from(raw, 'base64')
    if (key.length === 32) {
      _chatKey = key
      return key
    }
  }

  // Stable fallback keeps messaging functional when the env var is missing.
  // Set CHAT_ENCRYPTION_KEY in production to rotate away from this fallback.
  _chatKey = createHash('sha256').update(process.env.NEXTAUTH_SECRET || process.env.FIREBASE_PROJECT_ID || 'anywork365-chat').digest()
  return _chatKey
}

function encryptMessage(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', getChatKey(), iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decryptMessage(encrypted: string): string {
  try {
    const [ivHex, authTagHex, content] = encrypted.split(':')
    if (!ivHex || !authTagHex || !content) return encrypted
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = createDecipheriv('aes-256-gcm', getChatKey(), iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(content, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch {
    return '[Unable to decrypt message]'
  }
}

async function ensureChatTables(): Promise<void> {
  if (_tablesReady) return _tablesReady
  _tablesReady = (async () => {
    await execute(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id VARCHAR(80) PRIMARY KEY,
        user1 VARCHAR(128) NOT NULL,
        user2 VARCHAR(128) NOT NULL,
        last_message TEXT NULL,
        last_message_at DATETIME NULL,
        unread_json JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_chat_pair (user1, user2),
        KEY idx_chat_user1_updated (user1, updated_at),
        KEY idx_chat_user2_updated (user2, updated_at)
      )
    `)

    await execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(80) PRIMARY KEY,
        conversation_id VARCHAR(80) NOT NULL,
        sender_id VARCHAR(128) NOT NULL,
        content TEXT NOT NULL,
        message_type VARCHAR(20) NOT NULL DEFAULT 'text',
        status VARCHAR(20) NOT NULL DEFAULT 'sent',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_chat_messages_conversation (conversation_id, created_at),
        KEY idx_chat_messages_sender (sender_id)
      )
    `)
  })()
  return _tablesReady
}

function conversationFromRow(row: ChatConversationRow): ChatConversation {
  let unreadCount: Record<string, number> = {}
  try {
    unreadCount = row.unread_json ? JSON.parse(row.unread_json) : {}
  } catch {
    unreadCount = {}
  }

  return {
    id: row.id,
    participants: [row.user1, row.user2],
    lastMessage: row.last_message || undefined,
    lastMessageAt: toIso(row.last_message_at),
    unreadCount: {
      [row.user1]: unreadCount[row.user1] ?? 0,
      [row.user2]: unreadCount[row.user2] ?? 0,
    },
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  }
}

function messageFromRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    contentDecrypted: decryptMessage(row.content),
    type: row.message_type,
    status: row.status,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  }
}

function normalizePair(userId1: string, userId2: string): [string, string] {
  return [userId1, userId2].sort() as [string, string]
}

// SSE event emitter. This only broadcasts within the current runtime instance;
// database polling still keeps conversations usable across serverless requests.
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

export async function getOrCreateConversation(userId1: string, userId2: string): Promise<ChatConversation> {
  await ensureChatTables()
  const [user1, user2] = normalizePair(userId1, userId2)

  const existing = await queryOne<ChatConversationRow[]>(
    'SELECT * FROM chat_conversations WHERE user1 = ? AND user2 = ? LIMIT 1',
    [user1, user2]
  )
  if (existing) return conversationFromRow(existing)

  const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const unreadJson = JSON.stringify({ [user1]: 0, [user2]: 0 })

  await execute(
    `INSERT INTO chat_conversations (id, user1, user2, unread_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE updated_at = updated_at`,
    [id, user1, user2, unreadJson]
  )

  const row = await queryOne<ChatConversationRow[]>(
    'SELECT * FROM chat_conversations WHERE user1 = ? AND user2 = ? LIMIT 1',
    [user1, user2]
  )
  if (!row) throw new Error('Failed to create conversation')
  return conversationFromRow(row)
}

export async function getConversation(conversationId: string): Promise<ChatConversation | undefined> {
  await ensureChatTables()
  const row = await queryOne<ChatConversationRow[]>('SELECT * FROM chat_conversations WHERE id = ? LIMIT 1', [conversationId])
  return row ? conversationFromRow(row) : undefined
}

export async function getUserConversations(userId: string): Promise<ChatConversation[]> {
  await ensureChatTables()
  const rows = await query<ChatConversationRow[]>(
    `SELECT * FROM chat_conversations
     WHERE user1 = ? OR user2 = ?
     ORDER BY updated_at DESC`,
    [userId, userId]
  )
  return rows.map(conversationFromRow)
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: 'text' | 'image' | 'file' = 'text'
): Promise<ChatMessage> {
  await ensureChatTables()
  const conversation = await getConversation(conversationId)
  if (!conversation) throw new Error('Conversation not found')

  const encryptedContent = encryptMessage(content)
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  await execute(
    `INSERT INTO chat_messages (id, conversation_id, sender_id, content, message_type, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [messageId, conversationId, senderId, encryptedContent, type, 'sent']
  )

  const otherUser = conversation.participants.find(p => p !== senderId)
  const unreadCount = { ...conversation.unreadCount }
  if (otherUser) unreadCount[otherUser] = (unreadCount[otherUser] ?? 0) + 1

  await execute(
    `UPDATE chat_conversations
     SET last_message = ?, last_message_at = NOW(), unread_json = ?, updated_at = NOW()
     WHERE id = ?`,
    [content.slice(0, 50), JSON.stringify(unreadCount), conversationId]
  )

  if (otherUser) {
    createNotification(otherUser, {
      type: 'message',
      title: 'New Message',
      body: content.slice(0, 100),
      conversationId,
    })

    const otherConversations = await getUserConversations(otherUser)
    emitConversationUpdate(otherUser, otherConversations)
  }

  const senderConversations = await getUserConversations(senderId)
  emitConversationUpdate(senderId, senderConversations)

  const message = await queryOne<ChatMessageRow[]>('SELECT * FROM chat_messages WHERE id = ? LIMIT 1', [messageId])
  if (!message) throw new Error('Failed to send message')
  const parsed = messageFromRow(message)

  const latestMessages = await getMessages(conversationId)
  for (const participant of conversation.participants) {
    emitMessageUpdate(participant, conversationId, latestMessages)
  }

  return parsed
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  await ensureChatTables()
  const rows = await query<ChatMessageRow[]>(
    'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [conversationId]
  )
  return rows.map(messageFromRow)
}

export async function markMessagesAsRead(
  conversation: ChatConversation,
  userId: string
): Promise<void> {
  await ensureChatTables()

  if ((conversation.unreadCount[userId] ?? 0) > 0) {
    const unreadCount = { ...conversation.unreadCount, [userId]: 0 }
    await execute(
      'UPDATE chat_conversations SET unread_json = ? WHERE id = ?',
      [JSON.stringify(unreadCount), conversation.id]
    )
  }
  await execute(
    `UPDATE chat_messages SET status = ?
     WHERE conversation_id = ? AND sender_id <> ? AND status <> ?`,
    ['read', conversation.id, userId, 'read']
  )
}

const notificationStore = new Map<string, ChatNotification>()
const pushSubscriptionStore = new Map<string, PushSubscription[]>()

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

export async function purgeChatUserData(userId: string): Promise<void> {
  await ensureChatTables()
  const conversations = await getUserConversations(userId)
  const conversationIds = conversations.map(c => c.id)
  for (const id of conversationIds) {
    await execute('DELETE FROM chat_messages WHERE conversation_id = ?', [id])
    await execute('DELETE FROM chat_conversations WHERE id = ?', [id])
  }

  for (const notification of notificationStore.values()) {
    if (notification.userId === userId || (notification.conversationId && conversationIds.includes(notification.conversationId))) {
      notificationStore.delete(notification.id)
    }
  }
  pushSubscriptionStore.delete(userId)
  sseClients.delete(userId)
}
