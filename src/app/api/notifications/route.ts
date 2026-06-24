import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUserNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/queries'
import { savePushSubscription } from '@/lib/chat'
import type { ApiResponse } from '@/types'

function serializeNotifications(notifications: Awaited<ReturnType<typeof getUserNotifications>>) {
  return notifications.map((notification) => ({
    id: notification.id,
    body: notification.body,
    createdAt: notification.dateCreated,
    isRead: notification.seenByReciever === 1,
  }))
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const notifications = await getUserNotifications(session.id)
    const unreadCount = await getUnreadNotificationCount(session.id)

    return NextResponse.json(
      { success: true, data: { notifications: serializeNotifications(notifications), unreadCount } },
      { headers: { 'Cache-Control': 'private, no-cache' } }
    )
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()

    if (body.endpoint && body.keys) {
      const subscription = savePushSubscription(session.id, {
        endpoint: body.endpoint,
        keys: body.keys,
      })
      return NextResponse.json({
        success: true,
        data: { subscription },
      })
    }

    if (body.notificationId) {
      await markNotificationAsRead(body.notificationId, session.id)
    } else if (body.markAllRead) {
      await markAllNotificationsAsRead(session.id)
    }

    const notifications = await getUserNotifications(session.id)
    const unreadCount = await getUnreadNotificationCount(session.id)

    return NextResponse.json({
      success: true,
      data: { notifications: serializeNotifications(notifications), unreadCount },
    })
  } catch (error) {
    console.error('Notifications POST error:', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
