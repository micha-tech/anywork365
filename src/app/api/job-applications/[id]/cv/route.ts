import { getStorage } from 'firebase-admin/storage'
import { NextRequest, NextResponse } from 'next/server'
import { getVerifiedSession } from '@/lib/auth'
import { firebaseAdminApp } from '@/lib/firebase/admin'
import { getApplicationForFile } from '@/lib/queries'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedSession()
  if (!session) return new NextResponse('Authentication required', { status: 401 })

  const { id } = await params
  const applicationId = Number(id)
  const application = Number.isInteger(applicationId) ? await getApplicationForFile(applicationId) : null
  if (!application || !application.cv) return new NextResponse('CV not found', { status: 404 })

  const canRead = application.uid === session.id
    || (session.role === 'recruiter' && application.posted_by_uid === session.id)
    || session.role === 'admin'
  if (!canRead) return new NextResponse('Forbidden', { status: 403 })

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (!bucketName) return new NextResponse('Storage is not configured', { status: 503 })

  try {
    const [buffer] = await getStorage(firebaseAdminApp).bucket(bucketName).file(application.cv).download()
    const safeName = (application.cv_original_name || 'cv.pdf').replace(/[^a-zA-Z0-9._ -]/g, '_')
    return new NextResponse(Uint8Array.from(buffer).buffer, {
      headers: {
        'Content-Type': application.cv_mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[APPLICATION CV]', error)
    return new NextResponse('CV not found', { status: 404 })
  }
}
