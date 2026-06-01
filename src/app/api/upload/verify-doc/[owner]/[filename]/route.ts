import { readFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getVerificationDocMimeType,
  getVerificationDocOwnerSegment,
  resolveVerificationDocPath,
} from '@/lib/verification-docs'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; filename: string }> }
) {
  const session = await getSession()
  if (!session) {
    return new NextResponse('Authentication required', { status: 401 })
  }

  const { owner, filename } = await params
  const isOwner = owner === getVerificationDocOwnerSegment(session.id)
  const isAdmin = session.role === 'admin'

  if (!isOwner && !isAdmin) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const target = resolveVerificationDocPath(owner, filename)
  if (!target) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const file = await readFile(target.filepath)
    return new NextResponse(new Uint8Array(file), {
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
