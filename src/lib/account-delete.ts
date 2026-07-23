import { unlink } from 'fs/promises'
import { join, normalize } from 'path'
import { getStorage } from 'firebase-admin/storage'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { auth as adminAuth, firebaseAdminApp } from '@/lib/firebase/admin'
import { getConnection, query, type SqlValue } from '@/lib/db'
import { purgeChatUserData } from '@/lib/chat'
import {
  getVerificationDocObjectPath,
  getVerificationDocOwnerSegment,
  resolveVerificationDocPath,
} from '@/lib/verification-docs'

type IdRow = RowDataPacket & { id: number }
type FileRow = RowDataPacket & Record<string, string | null>
type UserDeleteRow = RowDataPacket & { userId: number; uid: string; profileImage: string | null }

function placeholders(values: unknown[]): string {
  return values.map(() => '?').join(', ')
}

async function deleteWhereIn(
  conn: PoolConnection,
  table: string,
  column: string,
  values: number[] | string[]
): Promise<void> {
  if (values.length === 0) return
  await conn.execute(`DELETE FROM ${table} WHERE ${column} IN (${placeholders(values)})`, values as SqlValue[])
}

async function deleteFiles(urls: string[]): Promise<void> {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  const publicRoot = normalize(join(process.cwd(), 'public'))

  await Promise.all(urls.filter(Boolean).map(async (rawUrl) => {
    try {
      const verificationMatch = rawUrl.match(/^\/api\/upload\/verify-doc\/([a-f0-9]{32})\/([^/]+)$/)
      if (verificationMatch) {
        const [, owner, filename] = verificationMatch
        const objectPath = getVerificationDocObjectPath(owner, filename)
        if (bucketName && objectPath) {
          await getStorage(firebaseAdminApp).bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true })
        }
        const legacyTarget = resolveVerificationDocPath(owner, filename)
        if (legacyTarget) await unlink(legacyTarget.filepath).catch(() => {})
        return
      }

      if (rawUrl.startsWith('/uploads/')) {
        const filepath = normalize(join(process.cwd(), 'public', rawUrl))
        if (filepath.startsWith(publicRoot)) await unlink(filepath).catch(() => {})
        return
      }

      if (!bucketName || !/^https?:\/\//i.test(rawUrl)) return

      const url = new URL(rawUrl)
      let objectPath: string | null = null
      const storagePrefix = `/${bucketName}/`
      const firebasePrefix = `/v0/b/${bucketName}/o/`

      if (url.hostname === 'storage.googleapis.com' && url.pathname.startsWith(storagePrefix)) {
        objectPath = decodeURIComponent(url.pathname.slice(storagePrefix.length))
      } else if (url.hostname === 'firebasestorage.googleapis.com' && url.pathname.startsWith(firebasePrefix)) {
        objectPath = decodeURIComponent(url.pathname.slice(firebasePrefix.length))
      }

      if (objectPath) {
        await getStorage(firebaseAdminApp).bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true })
      }
    } catch (error) {
      console.warn('[ACCOUNT DELETE FILE WARN]', error)
    }
  }))
}

export async function hardDeleteAccount(uid: string): Promise<void> {
  const users = await query<UserDeleteRow[]>(
    'SELECT userId, uid, profileImage FROM users WHERE uid = ? LIMIT 1',
    [uid]
  )
  const user = users[0]
  if (!user) {
    try { await adminAuth.deleteUser(uid) } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error
    }
    return
  }

  const [businessRows, companyRows, walletRows, portfolioRows] = await Promise.all([
    query<IdRow[]>('SELECT businessId AS id FROM businesses WHERE uid = ?', [uid]),
    query<IdRow[]>('SELECT company_id AS id FROM companies WHERE uid = ?', [uid]),
    query<IdRow[]>('SELECT id FROM wallets WHERE user_id = ?', [user.userId]),
    query<FileRow[]>('SELECT imageUrl FROM user_portfolio WHERE uid = ?', [uid]),
  ])

  const businessIds = businessRows.map((row) => row.id)
  const companyIds = companyRows.map((row) => row.id)
  const walletIds = walletRows.map((row) => row.id)

  const vacancyRows = companyIds.length
    ? await query<IdRow[]>(`SELECT vacancy_id AS id FROM vacancies WHERE company_id IN (${placeholders(companyIds)})`, companyIds)
    : []
  const vacancyIds = vacancyRows.map((row) => row.id)

  const bookingConditions = ['clientUID = ?']
  const bookingParams: SqlValue[] = [uid]
  if (businessIds.length) {
    bookingConditions.push(`businessId IN (${placeholders(businessIds)})`)
    bookingParams.push(...businessIds)
  }
  const bookingRows = await query<IdRow[]>(
    `SELECT bookingId AS id FROM bookings WHERE ${bookingConditions.join(' OR ')}`,
    bookingParams
  )
  const bookingIds = bookingRows.map((row) => row.id)

  const verificationRows = businessIds.length
    ? await query<FileRow[]>(
        `SELECT photo_url, nin_card_url, utility_bill_url, business_registration_url, trade_certificate_url
         FROM business_verifications WHERE businessId IN (${placeholders(businessIds)})`,
        businessIds
      )
    : []
  const businessLogoRows = await query<FileRow[]>('SELECT businessLogo FROM businesses WHERE uid = ?', [uid])

  const fileUrls = [
    user.profileImage,
    ...portfolioRows.map((row) => row.imageUrl),
    ...businessLogoRows.map((row) => row.businessLogo),
    ...verificationRows.flatMap((row) => [
      row.photo_url,
      row.nin_card_url,
      row.utility_bill_url,
      row.business_registration_url,
      row.trade_certificate_url,
    ]),
  ].filter((value): value is string => !!value)

  const conn = await getConnection()
  try {
    await conn.beginTransaction()

    if (bookingIds.length) {
      await deleteWhereIn(conn, 'disputes', 'bookingId', bookingIds)
      await deleteWhereIn(conn, 'wallet_escrow', 'booking_id', bookingIds)
      await deleteWhereIn(conn, 'reviews', 'bookingId', bookingIds)
    }
    await conn.execute(
      'DELETE FROM disputes WHERE clientUid = ? OR vendorUid = ? OR raisedBy = ? OR resolvedBy = ?',
      [uid, uid, uid, uid]
    )

    if (walletIds.length) {
      await conn.execute(
        `DELETE FROM wallet_escrow WHERE client_wallet_id IN (${placeholders(walletIds)}) OR vendor_wallet_id IN (${placeholders(walletIds)})`,
        [...walletIds, ...walletIds]
      )
      await deleteWhereIn(conn, 'wallet_ledger', 'wallet_id', walletIds)
      await deleteWhereIn(conn, 'withdrawals', 'wallet_id', walletIds)
    }
    await conn.execute('DELETE FROM withdrawals WHERE user_id = ?', [user.userId])
    await conn.execute('DELETE FROM withdrawal_accounts WHERE user_id = ?', [user.userId])
    await conn.execute('DELETE FROM wallets WHERE user_id = ?', [user.userId])
    await conn.execute(
      `DELETE FROM wallet_transactions
       WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.userId')) = ?
          OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.user_id')) = ?`,
      [uid, uid]
    )

    if (businessIds.length) {
      await deleteWhereIn(conn, 'business_verifications', 'businessId', businessIds)
      await deleteWhereIn(conn, 'reviews', 'businessId', businessIds)
      await deleteWhereIn(conn, 'business_ratings', 'businessId', businessIds)
      await deleteWhereIn(conn, 'favorites', 'business_id', businessIds)
      await deleteWhereIn(conn, 'bookings', 'businessId', businessIds)
    }
    await conn.execute('DELETE FROM reviews WHERE userUid = ?', [uid])
    await conn.execute('DELETE FROM business_ratings WHERE userUid = ?', [uid])
    await conn.execute('DELETE FROM favorites WHERE uid = ?', [uid])

    if (vacancyIds.length) {
      await deleteWhereIn(conn, 'vacancy_applications', 'vacancy_id', vacancyIds)
      await deleteWhereIn(conn, 'vacancies', 'vacancy_id', vacancyIds)
    }
    await conn.execute('DELETE FROM vacancy_applications WHERE uid = ?', [uid])
    if (companyIds.length) await deleteWhereIn(conn, 'companies', 'company_id', companyIds)

    await conn.execute('DELETE FROM bookings WHERE clientUID = ?', [uid])
    await conn.execute('DELETE FROM user_portfolio WHERE uid = ?', [uid])
    await conn.execute('DELETE FROM professional_profiles WHERE uid = ?', [uid])
    await conn.execute('DELETE FROM recruiter_profiles WHERE uid = ?', [uid])
    await conn.execute('DELETE FROM businesses WHERE uid = ?', [uid])
    await conn.execute('DELETE FROM users_notifications WHERE senderUid = ? OR recieverUid = ?', [uid, uid])
    await conn.execute('DELETE FROM user_fcm_tokens WHERE uid = ?', [uid])
    await conn.execute('DELETE FROM admin_audit_log WHERE adminUid = ? OR targetId = ?', [uid, uid])
    await conn.execute('DELETE FROM users WHERE uid = ?', [uid])

    await conn.commit()
  } catch (error) {
    await conn.rollback().catch(() => {})
    throw error
  } finally {
    conn.release()
  }

  // The application data is the source of truth for account access and privacy.
  // Remove it transactionally first, then clean up external services without
  // turning an already-completed deletion into a user-facing failure.
  try {
    await adminAuth.deleteUser(uid)
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') {
      console.warn('[ACCOUNT DELETE FIREBASE WARN]', error)
    }
  }

  await deleteFiles(fileUrls)
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (bucketName) {
    const owner = getVerificationDocOwnerSegment(uid)
    await getStorage(firebaseAdminApp).bucket(bucketName).deleteFiles({
      prefix: `verification/${owner}/`,
      force: true,
    }).catch((error) => console.warn('[ACCOUNT DELETE VERIFICATION FILE WARN]', error))
  }
  await purgeChatUserData(uid).catch((error) => {
    console.warn('[ACCOUNT DELETE CHAT WARN]', error)
  })
}
