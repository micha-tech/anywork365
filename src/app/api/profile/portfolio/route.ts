import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from 'firebase-admin/storage'
import { getSession } from '@/lib/auth'
import { firebaseAdminApp } from '@/lib/firebase/admin'
import { checkRateLimit } from '@/lib/wallet'
import { createPortfolioItem, getPortfolioByUid } from '@/lib/queries'
import type { ApiResponse, PortfolioItem } from '@/types'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function hasValidSignature(buffer: Buffer, type: string): boolean {
  if (type === 'image/jpeg' || type === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (type === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (type === 'image/webp') {
    return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
  }
  return false
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const portfolio = await getPortfolioByUid(session.id)
  return NextResponse.json<ApiResponse<PortfolioItem[]>>({ success: true, data: portfolio })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }
  if (session.role !== 'vendor') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Portfolio items are available to vendors' },
      { status: 403 }
    )
  }

  const rateLimit = checkRateLimit(`portfolio:${session.id}`, 8, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: `Too many uploads. Try again in ${rateLimit.retryAfter} seconds.` },
      { status: 429 }
    )
  }

  try {
    const form = await req.formData()
    const file = form.get('image') as File | null
    const title = String(form.get('title') || '').trim()
    const description = String(form.get('description') || '').trim()

    if (!title || title.length > 120) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Enter a portfolio title under 120 characters' },
        { status: 400 }
      )
    }
    if (description.length > 500) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Portfolio description must be under 500 characters' },
        { status: 400 }
      )
    }
    if (!file || !EXTENSIONS[file.type]) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Choose a JPEG, PNG, or WebP image' },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Portfolio image must be smaller than 5MB' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!hasValidSignature(buffer, file.type)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Image content does not match its file type' },
        { status: 400 }
      )
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (!bucketName) throw new Error('Firebase Storage bucket is not configured')

    const objectPath = `portfolio/${session.id}/${randomUUID()}.${EXTENSIONS[file.type]}`
    const downloadToken = randomUUID()
    const bucket = getStorage(firebaseAdminApp).bucket(bucketName)
    await bucket.file(objectPath).save(buffer, {
      resumable: false,
      contentType: file.type,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    })

    const encodedPath = encodeURIComponent(objectPath)
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodedPath}?alt=media&token=${downloadToken}`
    const item = await createPortfolioItem({
      uid: session.id,
      title,
      description: description || undefined,
      imageUrl,
    })

    return NextResponse.json<ApiResponse<PortfolioItem>>(
      { success: true, data: item, message: 'Portfolio item added' },
      { status: 201 }
    )
  } catch (error) {
    console.error('[PORTFOLIO UPLOAD]', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Could not add portfolio item. Please try again.' },
      { status: 500 }
    )
  }
}
