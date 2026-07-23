import { NextRequest, NextResponse } from 'next/server'
import { auth as adminAuth } from '@/lib/firebase/admin'
import { createSessionCookie, setSession } from '@/lib/auth'
import { getUserByEmail, getUserByUid, getUserRowByUid } from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse, AuthUser } from '@/types'

export const runtime = 'nodejs'

type GoogleAuthData = {
  user: AuthUser | null
  needsProfile: boolean
  email: string
  firstName: string
  lastName: string
}

function splitDisplayName(name?: string): { firstName: string; lastName: string } {
  const parts = name?.trim().split(/\s+/).filter(Boolean) || []
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  }
}

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    if (!idToken) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Google sign-in token is required.' },
        { status: 400 }
      )
    }

    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const rateLimit = checkRateLimit(`google-auth:${ip}`, 10, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many sign-in attempts. Please try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      )
    }

    const decoded = await adminAuth.verifyIdToken(idToken)
    const provider = decoded.firebase?.sign_in_provider
    const email = decoded.email?.trim().toLowerCase() || ''

    if (provider !== 'google.com' || !email || decoded.email_verified !== true) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'We couldn’t verify this Google account.' },
        { status: 401 }
      )
    }

    const userRow = await getUserRowByUid(decoded.uid)
    if (userRow?.suspended) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Your account has been suspended. Please contact support@anywork365.ng.' },
        { status: 403 }
      )
    }

    const existingUser = await getUserByUid(decoded.uid)
    if (existingUser) {
      const sessionCookie = await createSessionCookie(idToken)
      if (!sessionCookie) throw new Error('Failed to create session')
      await setSession(sessionCookie)

      return NextResponse.json<ApiResponse<GoogleAuthData>>({
        success: true,
        data: {
          user: existingUser,
          needsProfile: false,
          email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
        },
      })
    }

    const existingEmailUser = await getUserByEmail(email)
    if (existingEmailUser && existingEmailUser.id !== decoded.uid) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'An account already exists with this email. Log in with your password first to connect Google.',
        },
        { status: 409 }
      )
    }

    const firebaseUser = await adminAuth.getUser(decoded.uid)
    const names = splitDisplayName(firebaseUser.displayName)

    return NextResponse.json<ApiResponse<GoogleAuthData>>({
      success: true,
      data: {
        user: null,
        needsProfile: true,
        email,
        firstName: names.firstName,
        lastName: names.lastName,
      },
      message: 'Complete your profile to finish creating your account.',
    })
  } catch (error) {
    console.error('[GOOGLE AUTH]', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'We couldn’t complete Google sign-in. Please try again.' },
      { status: 401 }
    )
  }
}
