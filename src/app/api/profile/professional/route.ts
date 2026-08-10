import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import { getProfessionalBackgroundByUid, updateProfessionalBackground } from '@/lib/queries'
import type { ApiResponse, ProfessionalBackground } from '@/types'

export const runtime = 'nodejs'

const currentYear = new Date().getFullYear()

const certificationSchema = z.object({
  name: z.string().trim().min(2, 'Enter the certification name').max(180),
  yearObtained: z.coerce.number().int().min(1950).max(currentYear),
})

const experienceSchema = z.object({
  jobTitle: z.string().trim().min(2, 'Enter the job title').max(160),
  employer: z.string().trim().min(2, 'Enter the employer').max(180),
  startYear: z.coerce.number().int().min(1950).max(currentYear),
  endYear: z.coerce.number().int().min(1950).max(currentYear).optional(),
  current: z.boolean(),
  description: z.string().trim().max(1200).optional(),
}).superRefine((experience, context) => {
  if (!experience.current && !experience.endYear) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endYear'], message: 'Enter the year this role ended' })
  }
  if (experience.endYear && experience.endYear < experience.startYear) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endYear'], message: 'End year cannot be before start year' })
  }
})

const backgroundSchema = z.object({
  schoolName: z.string().trim().max(220, 'School name must be under 220 characters'),
  certifications: z.array(certificationSchema).max(20, 'You can add up to 20 certifications'),
  workExperience: z.array(experienceSchema).max(20, 'You can add up to 20 work experiences'),
})

function requireProfessional(session: Awaited<ReturnType<typeof getVerifiedSession>>) {
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }
  if (session.role !== 'professional') {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'This section is only available to professional accounts' },
      { status: 403 }
    )
  }
  return null
}

export async function GET() {
  const session = await getVerifiedSession()
  const authError = requireProfessional(session)
  if (authError || !session) return authError

  try {
    const background = await getProfessionalBackgroundByUid(session.id)
    if (!background) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Professional profile not found' },
        { status: 404 }
      )
    }
    const parsed = backgroundSchema.safeParse(background)
    const data: ProfessionalBackground = parsed.success
      ? parsed.data
      : { schoolName: background.schoolName, certifications: [], workExperience: [] }
    return NextResponse.json<ApiResponse<ProfessionalBackground>>({ success: true, data })
  } catch (error) {
    console.error('[PROFESSIONAL BACKGROUND GET]', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Could not load your professional background' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getVerifiedSession()
  const authError = requireProfessional(session)
  if (authError || !session) return authError

  try {
    const parsed = backgroundSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.issues[0]?.message || 'Check your professional details' },
        { status: 400 }
      )
    }
    await updateProfessionalBackground(session.id, parsed.data)
    return NextResponse.json<ApiResponse<ProfessionalBackground>>({
      success: true,
      data: parsed.data,
      message: 'Professional background saved',
    })
  } catch (error) {
    console.error('[PROFESSIONAL BACKGROUND UPDATE]', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Could not save your professional background. Please try again.' },
      { status: 500 }
    )
  }
}
