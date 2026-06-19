/**
 * POST /api/upload/avatar
 * Accepts a multipart/form-data image upload
 * Validates: file type, file size, authenticated session
 * Saves to Firebase Storage and returns its download URL
 * Returns the public URL of the uploaded photo
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getStorage } from 'firebase-admin/storage'
import { getSession } from '@/lib/auth'
import { firebaseAdminApp } from '@/lib/firebase/admin'
import { updateUserProfile } from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/jpg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]],
}

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType]
  if (!signatures) return false
  const bufLen = buffer.length
  return signatures.some(sig => {
    if (sig.length > bufLen) return false
    return sig.every((byte, i) => byte === 0x00 || buffer[i] === byte)
  })
}



export async function POST(req: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────────────────────────
    const session = await getSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const rateLimit = checkRateLimit(`upload:${session.id}`, 10, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many uploads. Please try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      )
    }

    // ── Parse multipart form ────────────────────────────────────────────────
    const formData = await req.formData()
    const file     = formData.get('avatar') as File | null

    if (!file) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // ── Validate file type ──────────────────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only JPEG, PNG, and WebP images are allowed' },
        { status: 400 }
      )
    }

    // ── Validate file size ──────────────────────────────────────────────────
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Image must be smaller than 5MB' },
        { status: 400 }
      )
    }

    // ── Determine file extension ────────────────────────────────────────────
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg':  '.jpg',
      'image/png':  '.png',
      'image/webp': '.webp',
    }
    const ext      = extMap[file.type] ?? '.jpg'
    // Use userId as filename so re-uploading overwrites the old photo
    const filename = `${session.id}${ext}`

    // ── Validate and upload image ───────────────────────────────────────────
    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'File content does not match the expected format' },
        { status: 400 }
      )
    }
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (!bucketName) {
      throw new Error('Firebase Storage bucket is not configured')
    }

    const objectPath = `avatars/${filename}`
    const downloadToken = randomUUID()
    const bucket = getStorage(firebaseAdminApp).bucket(bucketName)
    await bucket.file(objectPath).save(buffer, {
      resumable: false,
      contentType: file.type,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    })

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`

    // ── Return public URL ───────────────────────────────────────────────────
    await updateUserProfile(session.id, { profileImage: publicUrl })

    return NextResponse.json<ApiResponse<{ url: string }>>(
      { success: true, data: { url: publicUrl }, message: 'Photo uploaded successfully' },
      { status: 200 }
    )
  } catch (err) {
    console.error('[AVATAR UPLOAD]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }
}
