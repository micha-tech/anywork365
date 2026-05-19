import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { saveFcmToken } from '@/lib/queries'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    await saveFcmToken(session.id, token)

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      message: 'FCM token registered',
    })
  } catch (error) {
    console.error('[REGISTER FCM]', error)
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to register push token' },
      { status: 500 }
    )
  }
}
