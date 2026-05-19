import { NextResponse } from 'next/server'
import { getSession, clearSession } from '@/lib/auth'
import { getUserRowByUid } from '@/lib/queries'
import type { ApiResponse, AuthUser } from '@/types'

export const runtime = 'nodejs'

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
    avatarUrl: row.profileImage ? `/uploads/${row.profileImage}` : session.avatarUrl,
  }

  return NextResponse.json<ApiResponse<AuthUser>>(
    { success: true, data: hydrated },
    { status: 200 }
  )
}

export async function POST() {
  await clearSession()
  return NextResponse.json<ApiResponse<null>>(
    { success: true, message: 'Logged out' },
    { status: 200 }
  )
}