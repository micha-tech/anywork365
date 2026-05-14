import { NextRequest, NextResponse } from 'next/server'
import { setSession, createSessionCookie } from '@/lib/auth'
import { auth as adminAuth } from '@/lib/firebase/admin'
import { createUser, createBusiness, getUserByUid } from '@/lib/queries'
import { signupSchema } from '@/lib/validators/auth'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse, AuthUser } from '@/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { idToken, ...profileData } = await req.json()
    if (!idToken) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Rate limiting: 5 signups per IP per minute
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const rateLimit = checkRateLimit(`signup:${ip}`, 5, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many signup attempts. Please try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      )
    }

    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid

    const existing = await getUserByUid(uid)
    if (existing) {
      const sessionCookie = await createSessionCookie(idToken)
      if (sessionCookie) await setSession(sessionCookie)
      return NextResponse.json<ApiResponse<AuthUser>>(
        { success: true, data: existing, message: 'Account already exists, logged in' },
        { status: 200 }
      )
    }

    const parsed = signupSchema.safeParse(profileData)
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { firstName, lastName, email, phone, nin, role, city } = parsed.data

    await createUser({
      uid,
      email,
      fullName: `${firstName} ${lastName}`,
      phoneNumber: phone,
      state: city || 'Lagos',
      nin,
    })

    if (role === 'vendor') {
      await createBusiness({
        uid,
        businessName: `${firstName} ${lastName}`,
        businessContact: phone,
        state: city || 'Lagos',
      })
    }

    const authUser: AuthUser = {
      id: uid,
      email,
      firstName,
      lastName,
      role,
      phone,
      city: city || 'Lagos',
    }

    const sessionCookie = await createSessionCookie(idToken)
    if (!sessionCookie) throw new Error('Failed to create session')
    await setSession(sessionCookie)

    return NextResponse.json<ApiResponse<AuthUser>>(
      { success: true, data: authUser, message: 'Account created successfully' },
      { status: 201 }
    )
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    console.error('[AUTH SIGNUP]', e)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Signup failed' },
      { status: 400 }
    )
  }
}
