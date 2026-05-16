import { cookies } from 'next/headers'
import type { AuthUser } from '@/types'
import { auth as adminAuth } from '@/lib/firebase/admin'
import { getUserRowByUid } from '@/lib/queries'

const COOKIE_NAME = '__session'
const COOKIE_MAX_AGE = 60 * 60 * 24

export async function createSessionCookie(idToken: string): Promise<string | null> {
  try {
    const expiresIn = COOKIE_MAX_AGE * 1000
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })
    return sessionCookie
  } catch {
    return null
  }
}

export async function verifySessionCookie(sessionCookie: string) {
  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true)
    return decodedClaims
  } catch {
    return null
  }
}

export async function getUserFromFirebase(uid: string): Promise<AuthUser | null> {
  try {
    const user = await getUserRowByUid(uid)
    if (!user) return null
    const parts = user.fullName.trim().split(/\s+/)
    return {
      id: uid,
      email: user.email,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      role: user.hasBusinessAccount ? 'vendor' : 'client',
      phone: user.phoneNumber,
      city: user.state || '',
      avatarUrl: user.profileImage ? `/uploads/${user.profileImage}` : undefined,
    }
  } catch {
    return null
  }
}

export async function setSession(sessionCookie: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value
  if (!sessionCookie) return null

  const decoded = await verifySessionCookie(sessionCookie)
  if (!decoded) return null

  const user = await getUserFromFirebase(decoded.uid)
  if (!user) return null

  return {
    ...user,
    emailVerified: decoded.email_verified ?? false,
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getFirebaseIdToken(): Promise<string | null> {
  try {
    const { getFirebaseAuth } = await import('@/lib/firebase/client')
    const auth = getFirebaseAuth()
    if (!auth) return null
    const user = auth.currentUser
    if (!user) return null
    return await user.getIdToken()
  } catch {
    return null
  }
}