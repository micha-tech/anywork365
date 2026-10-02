import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { requireAdminApi, unauthorized, logAdminAction } from '@/lib/admin'
import { execute, query } from '@/lib/db'
import { processBroadcastNotifications } from '@/lib/broadcast-notifications'

export const runtime = 'nodejs'

function stringField(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function validActionUrl(value: string): boolean {
  return !value || (value.startsWith('/') && !value.startsWith('//'))
}

function validImageUrl(value: string): boolean {
  if (!value) return true
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

export async function GET() {
  try {
    await requireAdminApi()
    const [campaigns, audience] = await Promise.all([
      query<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT id, title, body, image_url AS imageUrl, action_url AS actionUrl, status,
                delivered_count AS deliveredCount, failed_count AS failedCount, created_at AS createdAt, completed_at AS completedAt
         FROM broadcast_notifications ORDER BY id DESC LIMIT 20`
      ),
      query<(RowDataPacket & { users: number; devices: number })[]>(
        `SELECT COUNT(DISTINCT u.uid) AS users, COUNT(t.id) AS devices
         FROM users u LEFT JOIN user_fcm_tokens t ON t.uid = u.uid AND t.is_active = 1
         WHERE u.deleted = 0`
      ),
    ])
    return NextResponse.json({ success: true, data: { campaigns, audience: audience[0] ?? { users: 0, devices: 0 } } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    console.error('[ADMIN BROADCAST GET]', error)
    return NextResponse.json({ success: false, error: 'Could not load notification campaigns' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminApi()
    const payload = await req.json()
    const title = stringField(payload.title, 120)
    const body = stringField(payload.body, 1000)
    const imageUrl = stringField(payload.imageUrl, 2048)
    const actionUrl = stringField(payload.actionUrl, 1024)
    if (!title || !body) return NextResponse.json({ success: false, error: 'A title and message are required' }, { status: 400 })
    if (!validImageUrl(imageUrl)) return NextResponse.json({ success: false, error: 'Image URL must use HTTPS' }, { status: 400 })
    if (!validActionUrl(actionUrl)) return NextResponse.json({ success: false, error: 'Destination must be a page within Anywork365' }, { status: 400 })

    const result = await execute(
      `INSERT INTO broadcast_notifications (admin_uid, title, body, image_url, action_url)
       VALUES (?, ?, ?, ?, ?)`,
      [session.id, title, body, imageUrl || null, actionUrl || null]
    )
    await execute(
      `INSERT INTO users_notifications (senderUid, senderEmail, recieverUid, recieverEmail, body, dateCreated, seenByReciever)
       SELECT ?, ?, u.uid, u.email, ?, NOW(), 0 FROM users u WHERE u.deleted = 0`,
      [session.id, session.email, `${title}: ${body}`]
    )
    await logAdminAction(session.id, 'publish_broadcast_notification', 'broadcast_notification', String(result.insertId), {
      title, hasImage: Boolean(imageUrl), actionUrl: actionUrl || null,
    })

    // Start the first safe delivery batch immediately; the VPS worker completes the rest.
    processBroadcastNotifications(1).catch(error => console.error('[BROADCAST DELIVERY]', error))
    return NextResponse.json({ success: true, data: { id: result.insertId }, message: 'Notification queued for delivery' }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    console.error('[ADMIN BROADCAST POST]', error)
    return NextResponse.json({ success: false, error: 'Could not publish notification' }, { status: 500 })
  }
}
