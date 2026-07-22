import { randomUUID } from 'crypto'
import { getStorage } from 'firebase-admin/storage'
import { NextRequest, NextResponse } from 'next/server'
import { getVerifiedSession } from '@/lib/auth'
import { firebaseAdminApp } from '@/lib/firebase/admin'
import { getProfessionalProfileByUid, updateProfessionalCoverImage } from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'

const MAX_SIZE = 8 * 1024 * 1024
const FILE_TYPES: Record<string, { extension: string; signature: number[] }> = {
  'image/jpeg': { extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
  'image/jpg': { extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
  'image/png': { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47] },
  'image/webp': { extension: 'webp', signature: [0x52, 0x49, 0x46, 0x46] },
}
const MIME_BY_EXTENSION: Record<string, keyof typeof FILE_TYPES> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function matchesSignature(buffer: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => buffer[index] === byte)
}

async function getProfessionalSession() {
  const session = await getVerifiedSession()
  return session?.role === 'professional' ? session : null
}

async function deleteStoredCover(url: string | null, uid: string): Promise<void> {
  if (!url) return
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (!bucketName) return

  try {
    const parsed = new URL(url)
    const prefix = `/v0/b/${bucketName}/o/`
    if (parsed.hostname !== 'firebasestorage.googleapis.com' || !parsed.pathname.startsWith(prefix)) return
    const objectPath = decodeURIComponent(parsed.pathname.slice(prefix.length))
    if (!objectPath.startsWith(`professional-covers/${uid}/`)) return
    await getStorage(firebaseAdminApp).bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true })
  } catch (error) {
    console.error('[COVER IMAGE DELETE]', error)
  }
}

export async function GET() {
  const session = await getProfessionalSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Professional account required' }, { status: 403 })
  }
  const profile = await getProfessionalProfileByUid(session.id)
  return NextResponse.json<ApiResponse<{ url: string | null }>>({
    success: true,
    data: { url: profile?.cover_image_url || null },
  })
}

export async function POST(req: NextRequest) {
  const session = await getProfessionalSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Professional account required' }, { status: 403 })
  }

  const rateLimit = checkRateLimit(`professional-cover:${session.id}`, 5, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Too many cover uploads. Please wait and try again.' }, { status: 429 })
  }

  try {
    const form = await req.formData()
    const fileValue = form.get('cover')
    const file = fileValue && typeof fileValue !== 'string' ? fileValue : null
    if (!file) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Choose a cover image' }, { status: 400 })
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    const mimeType = FILE_TYPES[file.type] ? file.type : MIME_BY_EXTENSION[extension]
    const fileConfig = mimeType ? FILE_TYPES[mimeType] : undefined
    if (!fileConfig) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Use a JPEG, PNG, or WebP cover image' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Cover image must be smaller than 8MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!matchesSignature(buffer, fileConfig.signature)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Cover image content does not match its file type' }, { status: 400 })
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (!bucketName) throw new Error('Firebase Storage bucket is not configured')
    const existingProfile = await getProfessionalProfileByUid(session.id)
    const objectPath = `professional-covers/${session.id}/${randomUUID()}.${fileConfig.extension}`
    const downloadToken = randomUUID()
    const bucket = getStorage(firebaseAdminApp).bucket(bucketName)
    await bucket.file(objectPath).save(buffer, {
      resumable: false,
      contentType: mimeType,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    })

    const encodedPath = encodeURIComponent(objectPath)
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodedPath}?alt=media&token=${downloadToken}`
    try {
      await updateProfessionalCoverImage(session.id, publicUrl)
    } catch (error) {
      await bucket.file(objectPath).delete({ ignoreNotFound: true }).catch(() => undefined)
      throw error
    }
    await deleteStoredCover(existingProfile?.cover_image_url || null, session.id)

    return NextResponse.json<ApiResponse<{ url: string }>>({ success: true, data: { url: publicUrl }, message: 'Cover image updated' })
  } catch (error) {
    console.error('[COVER IMAGE UPLOAD]', error)
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Could not update your cover image. Please try again.' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await getProfessionalSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Professional account required' }, { status: 403 })
  }

  const profile = await getProfessionalProfileByUid(session.id)
  await updateProfessionalCoverImage(session.id, null)
  await deleteStoredCover(profile?.cover_image_url || null, session.id)
  return NextResponse.json<ApiResponse<null>>({ success: true, message: 'Cover image removed' })
}
