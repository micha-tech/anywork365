import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

export async function POST() {
  await clearSession()
  return NextResponse.json<ApiResponse<null>>(
    { success: true, message: 'Logged out' },
    { status: 200 }
  )
}
