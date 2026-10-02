import type { RowDataPacket } from 'mysql2'
import { execute, query } from '@/lib/db'

const FCM_BATCH_SIZE = 500

interface CampaignRow extends RowDataPacket {
  id: number
  title: string
  body: string
  image_url: string | null
  action_url: string | null
  audience_type: 'all' | 'selected'
  token_cursor: number
}

interface TokenRow extends RowDataPacket {
  id: number
  token: string
}

export async function processBroadcastNotifications(maxCampaigns = 1) {
  const campaigns = await query<CampaignRow[]>(
    `SELECT id, title, body, image_url, action_url, audience_type, token_cursor
     FROM broadcast_notifications
     WHERE status IN ('queued', 'sending')
     ORDER BY id ASC
     LIMIT ${Math.max(1, Math.min(maxCampaigns, 5))}`
  )

  const results = []
  for (const campaign of campaigns) results.push(await processCampaign(campaign))
  return results
}

async function processCampaign(campaign: CampaignRow) {
  await execute(
    `UPDATE broadcast_notifications
     SET status = 'sending', started_at = COALESCE(started_at, NOW()), last_error = NULL
     WHERE id = ?`,
    [campaign.id]
  )

  const tokens = await query<TokenRow[]>(
    campaign.audience_type === 'selected'
      ? `SELECT t.id, t.token FROM user_fcm_tokens t
         INNER JOIN users u ON u.uid = t.uid
         INNER JOIN broadcast_notification_recipients r ON r.uid = t.uid AND r.campaign_id = ${Number(campaign.id)}
         WHERE t.is_active = 1 AND u.deleted = 0 AND t.id > ? ORDER BY t.id ASC LIMIT ${FCM_BATCH_SIZE}`
      : `SELECT t.id, t.token FROM user_fcm_tokens t
         INNER JOIN users u ON u.uid = t.uid
         WHERE t.is_active = 1 AND u.deleted = 0 AND t.id > ? ORDER BY t.id ASC LIMIT ${FCM_BATCH_SIZE}`,
    [campaign.token_cursor]
  )

  if (tokens.length === 0) {
    await execute(
      `UPDATE broadcast_notifications SET status = 'completed', completed_at = NOW() WHERE id = ?`,
      [campaign.id]
    )
    return { id: campaign.id, completed: true, delivered: 0, failed: 0 }
  }

  try {
    const { messaging } = await import('@/lib/firebase/admin')
    const data: Record<string, string> = { broadcast_id: String(campaign.id) }
    if (campaign.action_url) data.action_url = campaign.action_url

    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map(({ token }) => token),
      notification: {
        title: campaign.title,
        body: campaign.body,
        ...(campaign.image_url ? { imageUrl: campaign.image_url } : {}),
      },
      data,
      android: {
        priority: 'high',
        notification: campaign.image_url ? { imageUrl: campaign.image_url } : undefined,
      },
      apns: { payload: { aps: { sound: 'default' } } },
      webpush: {
        notification: campaign.image_url ? { image: campaign.image_url } : undefined,
        fcmOptions: campaign.action_url ? { link: campaign.action_url } : undefined,
      },
    })

    const inactiveTokens = tokens.filter((_, index) => !response.responses[index]?.success).map(({ token }) => token)
    if (inactiveTokens.length) {
      await Promise.all(inactiveTokens.map(token => execute('UPDATE user_fcm_tokens SET is_active = 0 WHERE token = ?', [token])))
    }

    const cursor = tokens[tokens.length - 1].id
    await execute(
      `UPDATE broadcast_notifications
       SET token_cursor = ?, delivered_count = delivered_count + ?, failed_count = failed_count + ?,
           status = IF(? < ?, 'completed', 'sending'),
           completed_at = IF(? < ?, NOW(), completed_at)
       WHERE id = ?`,
      [cursor, response.successCount, response.failureCount, tokens.length, FCM_BATCH_SIZE, tokens.length, FCM_BATCH_SIZE, campaign.id]
    )
    return { id: campaign.id, completed: tokens.length < FCM_BATCH_SIZE, delivered: response.successCount, failed: response.failureCount }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown Firebase delivery error'
    await execute(`UPDATE broadcast_notifications SET status = 'failed', last_error = ? WHERE id = ?`, [message, campaign.id])
    throw error
  }
}
