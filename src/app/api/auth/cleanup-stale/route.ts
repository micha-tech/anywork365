import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Kept temporarily so older cached clients receive a safe, explicit response.
 * Signup recovery now requires proving ownership by signing in with the
 * existing Firebase password instead of deleting an account by email address.
 */
export async function POST() {
  return NextResponse.json<ApiResponse<null>>(
    {
      success: false,
      error: 'Please log in to continue, or use Google if that is how you created your account.',
    },
    { status: 410 }
  )
}
