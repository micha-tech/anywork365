import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from 'firebase-admin/storage'
import { requireAdminApi, unauthorized } from '@/lib/admin'
import { firebaseAdminApp } from '@/lib/firebase/admin'

export const runtime = 'nodejs'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function POST(req: NextRequest) {
  try {
    await requireAdminApi()
    const file = (await req.formData()).get('image')
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: 'Choose an image to upload' }, { status: 400 })
    if (!allowedTypes.has(file.type)) return NextResponse.json({ success: false, error: 'Use a JPEG, PNG, or WebP image' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ success: false, error: 'Image must be smaller than 5 MB' }, { status: 400 })
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (!bucketName) throw new Error('Firebase Storage bucket is not configured')
    const path = `broadcast-notifications/${randomUUID()}.${extensions[file.type]}`
    const token = randomUUID()
    await getStorage(firebaseAdminApp).bucket(bucketName).file(path).save(Buffer.from(await file.arrayBuffer()), {
      resumable: false,
      contentType: file.type,
      metadata: { cacheControl: 'public, max-age=31536000, immutable', metadata: { firebaseStorageDownloadTokens: token } },
    })
    const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
    return NextResponse.json({ success: true, data: { url } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorized()
    console.error('[ADMIN BROADCAST IMAGE]', error)
    return NextResponse.json({ success: false, error: 'Could not upload image' }, { status: 500 })
  }
}
