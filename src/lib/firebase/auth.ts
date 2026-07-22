import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
  applyActionCode,
  updatePassword as fUpdatePassword,
  onAuthStateChanged,
  User,
  type ActionCodeSettings,
} from 'firebase/auth'
import { getFirebaseAuth } from './client'
import { toAuthErrorMessage } from '@/lib/errors'
import type { AuthUser, UserRole } from '@/types'

export type VerificationTier = 'basic' | 'verified' | 'premium'

export interface SignUpData {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
  countryCode?: string
  nin?: string
  role?: UserRole
}

function requireFirebase() {
  const fb = getFirebaseAuth()
  if (!fb) {
    throw new Error(
      'Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY, ' +
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local'
    )
  }
  return fb
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function getEmailVerificationActionSettings(): ActionCodeSettings | undefined {
  if (typeof window === 'undefined') return undefined

  return {
    // Use the domain that is actually serving the signup page. This prevents a
    // stale deployment variable from producing an unauthorized continue URL.
    url: `${window.location.origin}/verify-email`,
    handleCodeInApp: false,
  }
}

function isUnauthorizedActionDomainError(code?: string, message?: string): boolean {
  return (
    code === 'auth/unauthorized-continue-uri' ||
    code === 'auth/unauthorized-domain' ||
    message?.toLowerCase().includes('domain is not authorized') === true
  )
}

function getVerificationEmailErrorMessage(code?: string, message?: string): string {
  if (isUnauthorizedActionDomainError(code, message)) {
    return 'We could not send the verification email. Please try again or contact support.'
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many verification emails were requested. Please wait a bit and try again.'
  }

  return 'Failed to send verification email. Please try again.'
}

export async function signUp({
  email,
  password,
}: SignUpData) {
  const fbAuth = requireFirebase()
  try {
    const normalizedEmail = normalizeEmail(email)
    const cred = await createUserWithEmailAndPassword(fbAuth, normalizedEmail, password)

    const authUser: AuthUser = { id: cred.user.uid, email: normalizedEmail, firstName: '', lastName: '', role: 'client' }
    return { data: authUser, user: cred.user, error: null }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    const message =
      isUnauthorizedActionDomainError(e?.code, e?.message) || e?.code === 'auth/too-many-requests'
        ? getVerificationEmailErrorMessage(e.code, e.message)
        : toAuthErrorMessage(e)
    return { data: null, error: { code: e?.code, message } }
  }
}

export async function deleteCurrentFirebaseUser(): Promise<{ error: string | null }> {
  const fbAuth = requireFirebase()
  const user = fbAuth.currentUser
  if (!user) return { error: null }

  try {
    await deleteUser(user)
    return { error: null }
  } catch {
    return { error: 'Could not clean up the incomplete signup. Please contact support.' }
  }
}

export async function sendVerificationEmail(): Promise<{ error: string | null }> {
  const fbAuth = requireFirebase()
  const user = fbAuth.currentUser
  if (!user) return { error: 'Not authenticated' }
  try {
    const actionSettings = getEmailVerificationActionSettings()
    await sendEmailVerification(user, actionSettings)
    return { error: null }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (isUnauthorizedActionDomainError(e?.code, e?.message)) {
      try {
        await sendEmailVerification(user)
        return { error: null }
      } catch (fallbackErr: unknown) {
        const fallback = fallbackErr as { code?: string; message?: string }
        return { error: getVerificationEmailErrorMessage(fallback?.code, fallback?.message) }
      }
    }
    return { error: getVerificationEmailErrorMessage(e?.code, e?.message) }
  }
}

export async function confirmEmailVerification(oobCode: string): Promise<{ error: string | null }> {
  const fbAuth = requireFirebase()
  try {
    await applyActionCode(fbAuth, oobCode)
    return { error: null }
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'auth/expired-action-code') {
      return { error: 'This verification link has expired. Please request a new one.' }
    }
    if (e?.code === 'auth/invalid-action-code') {
      return { error: 'This verification link is invalid or has already been used.' }
    }
    return { error: 'Could not verify this email link. Please request a new one.' }
  }
}

export async function reloadUser(): Promise<{ emailVerified: boolean; error: string | null }> {
  const fbAuth = requireFirebase()
  const user = fbAuth.currentUser
  if (!user) return { emailVerified: false, error: 'Not authenticated' }
  try {
    await user.reload()
    const refreshed = fbAuth.currentUser
    return { emailVerified: refreshed?.emailVerified ?? false, error: null }
  } catch {
    return { emailVerified: false, error: 'Failed to reload user. Please try again.' }
  }
}

export async function signIn({ email, password }: { email: string; password: string }) {
  const fbAuth = requireFirebase()
  try {
    const normalizedEmail = normalizeEmail(email)
    const cred = await signInWithEmailAndPassword(fbAuth, normalizedEmail, password)
    const authUser: AuthUser = {
      id: cred.user.uid,
      email: normalizedEmail,
      firstName: '',
      lastName: '',
      role: 'client',
    }
    return { data: { user: cred.user, profile: authUser }, error: null }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    return { data: null, error: { code: e?.code, message: toAuthErrorMessage(e) } }
  }
}

export async function signOut() {
  const fbAuth = requireFirebase()
  await fSignOut(fbAuth)
  return { error: null }
}

export async function getCurrentUser(): Promise<{
  user: AuthUser | null
  error: string | null
}> {
  const fbAuth = requireFirebase()
  const currentUser = fbAuth.currentUser
  if (!currentUser) return { user: null, error: null }

  try {
    const authUser: AuthUser = {
      id: currentUser.uid,
      email: currentUser.email || '',
      firstName: currentUser.displayName?.split(' ')[0] || '',
      lastName: currentUser.displayName?.split(' ').slice(1).join(' ') || '',
      role: 'client',
    }
    return { user: authUser, error: null }
  } catch {
    return { user: null, error: 'Failed to fetch user' }
  }
}

export async function resetPassword(email: string) {
  const fbAuth = requireFirebase()
  try {
    await sendPasswordResetEmail(fbAuth, email)
    return { error: null }
  } catch {
    return { error: 'Failed to send reset email. Please try again.' }
  }
}

export async function updatePassword(newPassword: string) {
  const fbAuth = requireFirebase()
  const user = fbAuth.currentUser
  if (!user) return { error: 'Not authenticated' }
  try {
    await fUpdatePassword(user, newPassword)
    return { error: null }
  } catch {
    return { error: 'Failed to update password. Please try again.' }
  }
}

export async function updateProfile(
  _userId: string,
  _updates: {
    firstName?: string
    lastName?: string
    phone?: string
    countryCode?: string
    profileImageUrl?: string
  }
) {
  return { error: null }
}

export function onAuthChange(callback: (user: User | null) => void) {
  const fbAuth = requireFirebase()
  return onAuthStateChanged(fbAuth, callback)
}
