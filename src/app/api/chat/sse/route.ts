/**
 * GET /api/chat/sse
 * Server-Sent Events for real-time chat updates
 */
import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUserConversations, getUserNotifications } from '@/lib/chat'

export const dynamic = 'force-dynamic'

const activeConnections = new Map<string, number>()
const MAX_CONNECTIONS_PER_USER = 3

export async function GET(req: NextRequest) {
  const session = await getSession()
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

      const sendEvent = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const checkForUpdates = () => {
        const conversations = getUserConversations(session.id)
        const latestConv = conversations.find(c => c.updatedAt)

        if (latestConv && new Date(latestConv.updatedAt).getTime() > lastMessageTime) {
          sendEvent('conversation_update', { conversations })
          lastMessageTime = Date.now()
        }

        const notifications = getUserNotifications(session.id)
        const unreadCount = notifications.filter(n => !n.isRead).length
        sendEvent('notification_update', { unreadCount })
      }

      sendEvent('connected', { userId: session.id })

      const intervalId = setInterval(checkForUpdates, 5000)

      req.signal.addEventListener('abort', () => {
        clearInterval(intervalId)
        const c = (activeConnections.get(session.id) ?? 1) - 1
        if (c <= 0) activeConnections.delete(session.id)
        else activeConnections.set(session.id, c)
        controller.close()
      })
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
