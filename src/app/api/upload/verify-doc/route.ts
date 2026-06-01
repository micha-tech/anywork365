import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { getSession } from '@/lib/auth'
import { checkRateLimit } from '@/lib/wallet'
import {
  createVerificationDocFilename,
  getVerificationDocOwnerSegment,
  getVerificationDocUrl,
  resolveVerificationDocPath,
  VERIFICATION_DOC_FIELDS,
  type VerificationDocField,
} from '@/lib/verification-docs'
import type { ApiResponse } from '@/types'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE_BYTES = 10 * 1024 * 1024

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/jpg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
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
    const session = await getSession()
    if (!session) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (session.role !== 'vendor') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only vendors can upload verification documents' },
        { status: 403 }
      )
    }

    const rateLimit = checkRateLimit(`verify-upload:${session.id}`, 10, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many uploads. Please try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      )
    }

    const formData = await req.formData()
    const field = formData.get('field') as string
    const file = formData.get('file') as File | null

    if (!field || !VERIFICATION_DOC_FIELDS.includes(field as VerificationDocField)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid document field' },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Only JPEG, PNG, WebP images and PDF files are allowed' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'File must be smaller than 10MB' },
        { status: 400 }
      )
    }

    const ownerSegment = getVerificationDocOwnerSegment(session.id)
    const filename = createVerificationDocFilename(field as VerificationDocField, file.type)
    const target = resolveVerificationDocPath(ownerSegment, filename)

    if (!target) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid upload path' },
        { status: 400 }
      )
    }

    await mkdir(target.directory, { recursive: true })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'File content does not match the expected format' },
        { status: 400 }
      )
    }
    await writeFile(target.filepath, buffer)

    const privateUrl = getVerificationDocUrl(ownerSegment, filename)

    return NextResponse.json<ApiResponse<{ url: string }>>(
      { success: true, data: { url: privateUrl } },
      { status: 200 }
    )
  } catch (err) {
    console.error('[VERIFY DOC UPLOAD]', err)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }
}
