import { NextRequest, NextResponse } from 'next/server'
import { setSession, createSessionCookie } from '@/lib/auth'
import { auth as adminAuth } from '@/lib/firebase/admin'
import { getUserRowByUid, getUserByUid } from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse, AuthUser } from '@/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    if (!idToken) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Rate limiting: 10 login attempts per IP per minute
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const rateLimit = checkRateLimit(`login:${ip}`, 10, 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.` },
        { status: 429 }
      )
    }

    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid

    // Check suspension BEFORE allowing login
    const userRow = await getUserRowByUid(uid)
    if (userRow?.suspended) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Your account has been suspended. Please contact support@anywork365.ng' },
        { status: 403 }
      )
    }

    const profile = await getUserByUid(uid)
    if (!profile) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const sessionCookie = await createSessionCookie(idToken)
    if (!sessionCookie) throw new Error('Failed to create session')
    await setSession(sessionCookie)

    return NextResponse.json<ApiResponse<AuthUser>>(
      { success: true, data: profile },
      { status: 200 }
    )
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    console.error('[LOGIN ERROR]', e)

    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    )
  }
}