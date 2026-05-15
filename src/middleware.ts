import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const protectedPaths = [
    '/dashboard',
    '/messages',
  ]

  const isProtectedPath = protectedPaths.some((p) => pathname.startsWith(p))
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  const sessionCookie = request.cookies.get('__session')?.value

  if (isProtectedPath && !sessionCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && sessionCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}