import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession, clearSession } from '@/lib/auth'
import { getUserRowByUid, updateBusiness, updateUserProfile } from '@/lib/queries'
import { getAvatarUrl } from '@/lib/avatar'
import { NIGERIAN_STATE_NAMES, type ApiResponse, type AuthUser, type NigerianState } from '@/types'
import { isLocalGovernmentInState } from '@/lib/nigeria-locations'

export const runtime = 'nodejs'

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(50),
  state: z.enum(NIGERIAN_STATE_NAMES),
  lga: z.string().trim().min(1, 'Local government is required').max(100),
  address: z.string().trim().min(5, 'Street address is required').max(500),
  bio: z.string().trim().max(1000, 'Bio must be under 1000 characters'),
}).superRefine((data, context) => {
  if (!isLocalGovernmentInState(data.state as NigerianState, data.lga)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lga'],
      message: 'Select a local government in the chosen state',
    })
  }
})

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    )
  }

  const row = await getUserRowByUid(session.id)
  if (!row) {
    return NextResponse.json<ApiResponse<AuthUser>>(
      { success: true, data: session },
      { status: 200 }
    )
  }

  // If user was suspended after login, clear session and block
  if (row.suspended) {
    await clearSession()
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Your account has been suspended. Please contact support@anywork365.ng' },
      { status: 403 }
    )
  }

  const hydrated: AuthUser = {
    ...session,
    phone: row.phoneNumber || session.phone,
    city: row.state || session.city,
    lga: row.lga || session.lga,
    address: row.address || session.address,
    bio: row.bio || session.bio,
    avatarUrl: getAvatarUrl(row.profileImage) ?? session.avatarUrl,
  }

  return NextResponse.json<ApiResponse<AuthUser>>(
    { success: true, data: hydrated },
    { status: 200 }
  )
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const parsed = profileSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid profile details' },
        { status: 400 }
      )
    }

    const { firstName, lastName, phone, state, lga, address, bio } = parsed.data
    await updateUserProfile(session.id, {
      fullName: `${firstName} ${lastName}`,
      phoneNumber: phone,
      state,
      lga,
      address,
      bio,
    })
    if (session.role === 'vendor') {
      await updateBusiness(session.id, {
        businessContact: phone,
        description: bio,
        location: address,
        state,
        lga,
      })
    }

    return NextResponse.json<ApiResponse<null>>(
      { success: true, message: 'Profile saved' },
      { status: 200 }
    )
  } catch (error) {
    console.error('[PROFILE UPDATE]', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Could not save profile. Please try again.' },
      { status: 500 }
    )
  }
}

export async function POST() {
  await clearSession()
  return NextResponse.json<ApiResponse<null>>(
    { success: true, message: 'Logged out' },
    { status: 200 }
  )
}
