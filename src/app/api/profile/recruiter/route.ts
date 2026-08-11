import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import { getRecruiterProfileByUid, getUserRowByUid, upsertRecruiterProfile } from '@/lib/queries'
import { COMPANY_SIZES, INDUSTRY_CATEGORIES, RECRUITMENT_FUNCTIONS } from '@/lib/registration-options'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

const recruiterProfileSchema = z.object({
  companyName: z.string().trim().min(2, 'Enter the company name').max(180),
  companySize: z.enum(COMPANY_SIZES),
  industryCategory: z.enum(INDUSTRY_CATEGORIES),
  recruitmentFunction: z.enum(RECRUITMENT_FUNCTIONS),
  position: z.string().trim().min(2, 'Enter your position').max(160),
  companyWebsite: z.union([
    z.literal(''),
    z.string().trim().url('Enter a valid company website'),
  ]),
})

type RecruiterProfileData = z.infer<typeof recruiterProfileSchema>

async function getAuthorizedUser(uid: string) {
  const user = await getUserRowByUid(uid)
  return user?.can_switch_client_recruiter === 1 ? user : null
}

export async function GET() {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }
  if (!await getAuthorizedUser(session.id)) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Recruiter profile access is not available for this account' },
      { status: 403 }
    )
  }

  const profile = await getRecruiterProfileByUid(session.id)
  const data: RecruiterProfileData | null = profile ? {
    companyName: profile.company_name,
    companySize: profile.company_size as RecruiterProfileData['companySize'],
    industryCategory: profile.industry_category as RecruiterProfileData['industryCategory'],
    recruitmentFunction: profile.recruitment_function as RecruiterProfileData['recruitmentFunction'],
    position: profile.position,
    companyWebsite: profile.company_website || '',
  } : null

  return NextResponse.json<ApiResponse<RecruiterProfileData | null>>({ success: true, data })
}

export async function PATCH(request: NextRequest) {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }
  if (!await getAuthorizedUser(session.id)) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Recruiter profile access is not available for this account' },
      { status: 403 }
    )
  }

  const parsed = recruiterProfileSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: parsed.error.issues[0]?.message || 'Check your recruiter details' },
      { status: 400 }
    )
  }

  try {
    await upsertRecruiterProfile({ uid: session.id, ...parsed.data })
    return NextResponse.json<ApiResponse<RecruiterProfileData>>({
      success: true,
      data: parsed.data,
      message: 'Recruiter profile saved',
    })
  } catch (error) {
    console.error('[RECRUITER PROFILE UPDATE]', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Could not save the recruiter profile. Please try again.' },
      { status: 500 }
    )
  }
}
