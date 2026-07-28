import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Lightweight JWT expiry check for the __session cookie.
 * Firebase session cookies are JWTs — we decode the payload to check
 * the `exp` claim without needing Firebase Admin SDK (Edge-unsafe).
 * Full cryptographic verification happens in the API routes via getSession().
 */
function getSessionPayload(cookie: string | undefined): { valid: boolean } {
  if (!cookie) return { valid: false }
  try {
    const parts = cookie.split('.')
    if (parts.length !== 3) return { valid: false }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return { valid: payload.exp > Math.floor(Date.now() / 1000) }
  } catch {
    return { valid: false }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const protectedPaths = [
    '/admin',
    '/support',
    '/dashboard',
    '/bookings',
    '/wallet',
    '/notifications',
    '/profile',
    '/messages',
  ]

  const isProtectedPath = protectedPaths.some((p) => pathname.startsWith(p))
  const isAuthPage = pathname === '/login' || pathname.startsWith('/signup')

  const sessionCookie = request.cookies.get('__session')?.value
  const session = getSessionPayload(sessionCookie)
  const sessionOk = session.valid

  if (isProtectedPath && !sessionOk) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && sessionOk) {
    const dest = request.nextUrl.searchParams.get('redirect') || '/home'
    const url = request.nextUrl.clone()
    url.pathname = dest
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
