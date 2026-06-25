import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from 'firebase-admin/storage'
import { getSession } from '@/lib/auth'
import { firebaseAdminApp } from '@/lib/firebase/admin'
import { deletePortfolioItem } from '@/lib/queries'
import type { ApiResponse } from '@/types'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const { id } = await params
  const portfolioId = Number.parseInt(id, 10)
  if (!Number.isInteger(portfolioId)) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Invalid portfolio item' },
      { status: 400 }
    )
  }

  const imageUrl = await deletePortfolioItem(portfolioId, session.id)
  if (!imageUrl) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Portfolio item not found' },
      { status: 404 }
    )
  }

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (bucketName) {
    try {
      const url = new URL(imageUrl)
      const prefix = `/${bucketName}/`
      if (url.hostname === 'storage.googleapis.com' && url.pathname.startsWith(prefix)) {
        const objectPath = decodeURIComponent(url.pathname.slice(prefix.length))
        await getStorage(firebaseAdminApp).bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true })
      } else if (url.hostname === 'firebasestorage.googleapis.com') {
        const firebasePrefix = `/v0/b/${bucketName}/o/`
        if (url.pathname.startsWith(firebasePrefix)) {
          const objectPath = decodeURIComponent(url.pathname.slice(firebasePrefix.length))
          await getStorage(firebaseAdminApp).bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true })
        }
      }
    } catch (error) {
      console.error('[PORTFOLIO FILE DELETE]', error)
    }
  }

  return NextResponse.json<ApiResponse<null>>({ success: true, message: 'Portfolio item removed' })
}
