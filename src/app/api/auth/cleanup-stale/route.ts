import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth as adminAuth } from '@/lib/firebase/admin'
import { getUserByEmail } from '@/lib/queries'
import { checkRateLimit } from '@/lib/wallet'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

const schema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const rateLimit = checkRateLimit(`cleanup-stale:${ip}`, 3, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: `Too many attempts. Please wait ${rateLimit.retryAfter} seconds.` },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid email address' },
      { status: 400 }
    )
  }

  const email = parsed.data.email.toLowerCase()
  const activeUser = await getUserByEmail(email)
  if (activeUser) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'An account with this email already exists. Please log in.' },
      { status: 409 }
    )
  }

  try {
    const firebaseUser = await adminAuth.getUserByEmail(email)
    await adminAuth.deleteUser(firebaseUser.uid)
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code !== 'auth/user-not-found') {
      console.error('[STALE AUTH CLEANUP]', error)
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Could not reset this email for signup. Please contact support.' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json<ApiResponse<null>>(
    { success: true, message: 'Email reset for signup' },
    { status: 200 }
  )
}
