import { readFile, unlink } from 'fs/promises'
import { getStorage } from 'firebase-admin/storage'
import { NextResponse } from 'next/server'
import { getVerifiedSession } from '@/lib/auth'
import { firebaseAdminApp } from '@/lib/firebase/admin'
import {
  getVerificationDocObjectPath,
  getVerificationDocMimeType,
  getVerificationDocOwnerSegment,
  resolveVerificationDocPath,
} from '@/lib/verification-docs'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; filename: string }> }
) {
  const session = await getVerifiedSession()
  if (!session) {
    return new NextResponse('Authentication required', { status: 401 })
  }

  const { owner, filename } = await params
  const isOwner = owner === getVerificationDocOwnerSegment(session.id)
  const isAdmin = session.role === 'admin'

  if (!isOwner && !isAdmin) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const objectPath = getVerificationDocObjectPath(owner, filename)
  const legacyTarget = resolveVerificationDocPath(owner, filename)
  if (!objectPath || !legacyTarget) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (!bucketName) throw new Error('Firebase Storage bucket is not configured')
    const [file] = await getStorage(firebaseAdminApp).bucket(bucketName).file(objectPath).download()
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': getVerificationDocMimeType(filename),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    try {
      const legacyFile = await readFile(legacyTarget.filepath)
      return new NextResponse(new Uint8Array(legacyFile), {
        headers: {
          'Content-Type': getVerificationDocMimeType(filename),
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `inline; filename="${filename}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {
      return new NextResponse('Not found', { status: 404 })
    }
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ owner: string; filename: string }> }
) {
  const session = await getVerifiedSession()
  if (!session) return new NextResponse('Authentication required', { status: 401 })

  const { owner, filename } = await params
  const isOwner = owner === getVerificationDocOwnerSegment(session.id)
  if (!isOwner && session.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const objectPath = getVerificationDocObjectPath(owner, filename)
  const legacyTarget = resolveVerificationDocPath(owner, filename)
  if (!objectPath || !legacyTarget) return new NextResponse('Not found', { status: 404 })

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (bucketName) {
    await getStorage(firebaseAdminApp).bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true })
  }
  await unlink(legacyTarget.filepath).catch(() => {})
  return new NextResponse(null, { status: 204 })
}
