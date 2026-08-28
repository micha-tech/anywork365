/**
 * GET /api/chat/sse
 * Server-Sent Events for real-time chat updates
 */
import { NextRequest } from 'next/server'
import { getVerifiedSession } from '@/lib/auth'
import { getUserConversations, getUserNotifications } from '@/lib/chat'
import { enrichChatConversations } from '@/lib/chat-enrichment'

export const dynamic = 'force-dynamic'

const activeConnections = new Map<string, number>()
const MAX_CONNECTIONS_PER_USER = 3
const MAX_STREAM_LIFETIME_MS = 4 * 60 * 1000

export async function GET(req: NextRequest) {
  const session = await getVerifiedSession()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const current = activeConnections.get(session.id) ?? 0
  if (current >= MAX_CONNECTIONS_PER_USER) {
    return new Response('Too many connections', { status: 429 })
  }
  activeConnections.set(session.id, current + 1)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let lastMessageTime = Date.now()
      let closed = false
      const timers: {
        intervalId?: ReturnType<typeof setInterval>
        lifetimeId?: ReturnType<typeof setTimeout>
      } = {}

      const releaseConnection = () => {
        if (closed) return
        closed = true
        if (timers.intervalId) clearInterval(timers.intervalId)
        if (timers.lifetimeId) clearTimeout(timers.lifetimeId)
        const count = (activeConnections.get(session.id) ?? 1) - 1
        if (count <= 0) activeConnections.delete(session.id)
        else activeConnections.set(session.id, count)
      }

      const closeStream = () => {
        if (closed) return
        releaseConnection()
        try {
          controller.close()
        } catch {}
      }

      const sendEvent = (event: string, data: object) => {
        if (closed) return
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const checkForUpdates = async () => {
        const conversations = await getUserConversations(session.id)
        const latestConv = conversations.find(c => c.updatedAt)

        if (latestConv && new Date(latestConv.updatedAt).getTime() > lastMessageTime) {
          const enriched = await enrichChatConversations(conversations, session.id)
          sendEvent('conversation_update', { conversations: enriched })
          lastMessageTime = Date.now()
        }

        const notifications = getUserNotifications(session.id)
        const unreadCount = notifications.filter(n => !n.isRead).length
        sendEvent('notification_update', { unreadCount })
      }

      sendEvent('connected', { userId: session.id })

      timers.intervalId = setInterval(() => {
        checkForUpdates().catch((error) => {
          console.error('Chat SSE update error:', error)
        })
      }, 5000)

      timers.lifetimeId = setTimeout(closeStream, MAX_STREAM_LIFETIME_MS)
      req.signal.addEventListener('abort', closeStream, { once: true })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
