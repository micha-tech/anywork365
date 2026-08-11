import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedSession } from '@/lib/auth'
import { getRecruiterProfileByUid, getUserRowByUid, updateUserRole } from '@/lib/queries'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

const switchSchema = z.object({
  targetRole: z.enum(['client', 'recruiter']),
})

export async function PATCH(request: NextRequest) {
  const session = await getVerifiedSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const user = await getUserRowByUid(session.id)
  if (!user || user.can_switch_client_recruiter !== 1) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Account switching is not available for this account' },
      { status: 403 }
    )
  }

  const parsed = switchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Choose a valid account type' },
      { status: 400 }
    )
  }

  if (parsed.data.targetRole === 'recruiter') {
    const recruiterProfile = await getRecruiterProfileByUid(session.id)
    if (!recruiterProfile) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Complete your recruiter profile before switching' },
        { status: 409 }
      )
    }
  }

  try {
    await updateUserRole(session.id, parsed.data.targetRole)
    return NextResponse.json<ApiResponse<{ activeRole: 'client' | 'recruiter' }>>({
      success: true,
      data: { activeRole: parsed.data.targetRole },
      message: `Switched to ${parsed.data.targetRole} profile`,
    })
  } catch (error) {
    console.error('[ACCOUNT MODE SWITCH]', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Could not switch account type. Please try again.' },
      { status: 500 }
    )
  }
}
