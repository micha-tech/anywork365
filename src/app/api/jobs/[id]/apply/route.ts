import { randomUUID } from 'crypto'
import { getStorage } from 'firebase-admin/storage'
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
  if (!session) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Authentication required' }, { status: 401 })
  }
  if (!session.emailVerified) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Verify your email before applying' }, { status: 403 })
  }
  const { id } = await params
  const vacancyId = Number(id)
  return NextResponse.json({ success: true, data: { hasApplied: await hasUserApplied(vacancyId, session.id) } })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Your session has expired. Log in to continue your application.' }, { status: 401 })
  }
  if (!session.emailVerified) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Verify your email before applying' }, { status: 403 })
  }
  if (session.role !== 'artisan' && session.role !== 'professional') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Only artisans and professionals can apply for jobs' },
      { status: 403 }
    )
  }

  const { id } = await params
  const vacancyId = Number(id)
  const vacancy = Number.isInteger(vacancyId) ? await getVacancyById(vacancyId) : null
  if (!vacancy || vacancy.closed || (vacancy.closing_date && new Date(vacancy.closing_date).getTime() < Date.now())) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'This job is no longer accepting applications' }, { status: 400 })
  }
  if (await hasUserApplied(vacancyId, session.id)) {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'You have already applied for this job' }, { status: 409 })
  }

  const rateLimit = checkRateLimit(`job-application:${session.id}`, 5, 60 * 1000)
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
      coverLetter: String(form.get('coverLetter') || ''),
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
    uploadedObjectPath = `job-applications/${vacancyId}/${session.id}/${randomUUID()}.${cvConfig.extension}`
    const bucket = getStorage(firebaseAdminApp).bucket(bucketName)
    await bucket.file(uploadedObjectPath).save(buffer, {
      resumable: false,
      contentType: cvMimeType,
      metadata: {
        cacheControl: 'private, no-store, max-age=0',
        metadata: { applicantUid: session.id, recruiterUid: vacancy.posted_by_uid || '' },
      },
    })

    const applicationId = await createApplication({
      vacancy_id: vacancyId,
      uid: session.id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      cv: uploadedObjectPath,
      cv_original_name: cv.name.slice(0, 255),
      cv_mime_type: cvMimeType,
      cover_letter: parsed.data.coverLetter,
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
