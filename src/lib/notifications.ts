import { query, execute } from './db'
import type { RowDataPacket } from 'mysql2'

interface FcmTokenRow extends RowDataPacket {
  uid: string
  token: string
  is_active: number
}

export async function getUserFcmTokens(uid: string): Promise<string[]> {
  try {
    const rows = await query<FcmTokenRow[]>(
      'SELECT token FROM user_fcm_tokens WHERE uid = ? AND is_active = 1',
      [uid]
    )
    return rows.map(r => r.token)
  } catch {
    return []
  }
}

export async function sendPushNotification(
  uid: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const tokens = await getUserFcmTokens(uid)
  if (tokens.length === 0) return

  try {
    const admin = await import('@/lib/firebase/admin').then(m => m.default)

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: data || {},
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    })

    const failedTokens: string[] = []
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        failedTokens.push(tokens[idx])
      }
    })

    if (failedTokens.length > 0) {
      for (const token of failedTokens) {
        await execute('UPDATE user_fcm_tokens SET is_active = 0 WHERE token = ?', [token])
      }
    }
  } catch (err) {
    console.error('[PUSH NOTIFICATION ERROR]', err)
  }
}
