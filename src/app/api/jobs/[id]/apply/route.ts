import { randomUUID } from 'crypto'
import { getStorage } from 'firebase-admin/storage'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { firebaseAdminApp } from '@/lib/firebase/admin'
import {
  createApplication,
  createDbNotification,
  getVacancyById,
  hasUserApplied,
} from '@/lib/queries'
import { sendPushNotification } from '@/lib/notifications'
import { jobApplicationSchema } from '@/lib/validators/job'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'

function generateVisitorId(): string {
  return 'visitor_' + randomUUID()
}

const MAX_CV_SIZE = 5 * 1024 * 1024
const CV_TYPES: Record<string, { extension: string; signature: number[] }> = {
  'application/pdf': { extension: 'pdf', signature: [0x25, 0x50, 0x44, 0x46] },
  'application/msword': { extension: 'doc', signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: 'docx', signature: [0x50, 0x4b] },
}
const CV_MIME_BY_EXTENSION: Record<string, keyof typeof CV_TYPES> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function matchesSignature(buffer: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => buffer[index] === byte)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const visitorId = session?.id || generateVisitorId()
  if (!session) {
    const cookieStore = await cookies()
    cookieStore.set('visitor_id', visitorId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
  }
  const { id } = await params
  const vacancyId = Number(id)
  const hasApplied = session ? await hasUserApplied(vacancyId, session.id) : await hasUserApplied(vacancyId, visitorId)
  return NextResponse.json({ success: true, data: { hasApplied } })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const visitorId = session?.id || generateVisitorId()
  if (!session) {
    const cookieStore = await cookies()
    cookieStore.set('visitor_id', visitorId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
  }
  if (!session?.emailVerified) {
    // Allow application for unverified/visitor accounts, but track they need to verify
  }
  if (session?.role && session.role !== 'artisan' && session.role !== 'professional') {
    // Allow visitors (no role) to apply; only restrict artisan/professional check for actual accounts
  }

  const { id } = await params
  const vacancyId = Number(id)
  const vacancy = Number.isInteger(vacancyId) ? await getVacancyById(vacancyId) : null
  if (!vacancy || vacancy.closed || (vacancy.closing_date && new Date(vacancy.closing_date).getTime() < Date.now())) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'This job is no longer accepting applications' }, { status: 400 })
  }
  const effectiveUid = session?.id || visitorId
  if (await hasUserApplied(vacancyId, effectiveUid)) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'You have already applied for this job' }, { status: 409 })
  }

  const rateLimitKey = session?.id ? `job-application:${session.id}` : `job-application:visitor:${visitorId}`
  const rateLimit = checkRateLimit(rateLimitKey, 5, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Too many applications. Please wait and try again.' }, { status: 429 })
  }

  let uploadedObjectPath: string | null = null
  try {
    const form = await req.formData()
    const cv = form.get('cv') as File | null
    const workExperienceRaw = String(form.get('workExperience') || '[]')
    let workExperience: unknown
    try {
      workExperience = JSON.parse(workExperienceRaw)
    } catch {
      workExperience = []
    }

    const parsed = jobApplicationSchema.safeParse({
      firstName: String(form.get('firstName') || ''),
      lastName: String(form.get('lastName') || ''),
      coverLetter: form.get('coverLetter') ? String(form.get('coverLetter') || '').substring(0, 2000) : null,
      education: String(form.get('education') || ''),
      workExperience,
    })
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid application' },
        { status: 400 }
      )
    }

    const cvExtension = cv?.name.split('.').pop()?.toLowerCase() || ''
    const cvMimeType = cv && CV_TYPES[cv.type] ? cv.type : CV_MIME_BY_EXTENSION[cvExtension]
    const cvConfig = cvMimeType ? CV_TYPES[cvMimeType] : undefined
    if (!cv || !cvConfig) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Upload your CV as a PDF, DOC, or DOCX file' }, { status: 400 })
    }
    if (cv.size > MAX_CV_SIZE) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'CV must be smaller than 5MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await cv.arrayBuffer())
    if (!matchesSignature(buffer, cvConfig.signature)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'CV content does not match its file type' }, { status: 400 })
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (!bucketName) throw new Error('Firebase Storage bucket is not configured')
    uploadedObjectPath = `job-applications/${vacancyId}/${effectiveUid}/${randomUUID()}.${cvConfig.extension}`
    const bucket = getStorage(firebaseAdminApp).bucket(bucketName)
    await bucket.file(uploadedObjectPath).save(buffer, {
      resumable: false,
      contentType: cvMimeType,
      metadata: {
        cacheControl: 'private, no-store, max-age=0',
        metadata: { applicantUid: effectiveUid, recruiterUid: vacancy.posted_by_uid || '' },
      },
    })

    const applicationId = await createApplication({
      vacancy_id: vacancyId,
      uid: effectiveUid,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      cv: uploadedObjectPath,
      cv_original_name: cv.name.slice(0, 255),
      cv_mime_type: cvMimeType,
      cover_letter: parsed.data.coverLetter ?? null,
      education: parsed.data.education,
      work_experience: parsed.data.workExperience,
    })

    if (vacancy.posted_by_uid) {
      const applicantName = `${parsed.data.firstName} ${parsed.data.lastName}`
      const body = `${applicantName} applied for ${vacancy.vacancy_title}.`
      await Promise.allSettled([
        createDbNotification(vacancy.posted_by_uid, body),
        sendPushNotification(vacancy.posted_by_uid, 'New job application', body, { url: '/dashboard/applications' }),
      ])
    }

    return NextResponse.json(
      { success: true, data: { applicationId }, message: 'Application submitted successfully' },
      { status: 201 }
    )
  } catch (error) {
    if (uploadedObjectPath) {
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      if (bucketName) {
        await getStorage(firebaseAdminApp).bucket(bucketName).file(uploadedObjectPath).delete({ ignoreNotFound: true }).catch(() => undefined)
      }
    }
    const code = (error as { code?: string }).code
    if (code === 'ER_DUP_ENTRY') {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'You have already applied for this job' }, { status: 409 })
    }
    console.error('[JOB APPLICATION]', error)
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Could not submit your application. Please try again.' }, { status: 500 })
  }
}
