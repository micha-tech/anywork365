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
  GoogleAuthProvider,
  signInWithPopup,
  linkWithCredential,
  User,
  type AuthError,
  type ActionCodeSettings,
} from 'firebase/auth'
import { getFirebaseAuth } from './client'
import { toAuthErrorMessage } from '@/lib/errors'
import type { AuthUser, UserRole } from '@/types'
import { getBrowserAuthRedirect, withAuthRedirect } from '@/lib/auth-redirect'

export type VerificationTier = 'basic' | 'verified' | 'premium'

const PENDING_GOOGLE_CREDENTIAL_KEY = 'anywork365_pending_google_credential'

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

  const verificationPath = withAuthRedirect('/verify-email', getBrowserAuthRedirect())

  return {
    // Use the domain that is actually serving the signup page. This prevents a
    // stale deployment variable from producing an unauthorized continue URL.
    url: `${window.location.origin}${verificationPath}`,
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

export async function signInWithGoogle(): Promise<{
  user: User | null
  error: { code?: string; message: string } | null
}> {
  const fbAuth = requireFirebase()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  try {
    const credential = await signInWithPopup(fbAuth, provider)
    return { user: credential.user, error: null }
  } catch (err: unknown) {
    const error = err as AuthError

    if (error.code === 'auth/account-exists-with-different-credential') {
      const pendingCredential = GoogleAuthProvider.credentialFromError(error)
      if (pendingCredential && typeof window !== 'undefined') {
        sessionStorage.setItem(PENDING_GOOGLE_CREDENTIAL_KEY, JSON.stringify({
          idToken: pendingCredential.idToken,
          accessToken: pendingCredential.accessToken,
          email: typeof error.customData?.email === 'string'
            ? normalizeEmail(error.customData.email)
            : null,
        }))
      }
      return {
        user: null,
        error: {
          code: error.code,
          message: 'An account already exists with this email. Log in with your password to connect Google.',
        },
      }
    }

    const messages: Record<string, string> = {
      'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
      'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
      'auth/popup-blocked': 'Your browser blocked Google sign-in. Allow pop-ups and try again.',
      'auth/operation-not-allowed': 'Google sign-in is not available yet. Please use email and password.',
      'auth/network-request-failed': 'We couldn’t connect to Google. Check your connection and try again.',
      'auth/unauthorized-domain': 'Google sign-in is not configured for this website yet.',
    }

    return {
      user: null,
      error: {
        code: error.code,
        message: messages[error.code] || 'We couldn’t sign you in with Google. Please try again.',
      },
    }
  }
}

export async function linkPendingGoogleCredential(user: User): Promise<{
  linked: boolean
  error: string | null
}> {
  if (typeof window === 'undefined') return { linked: false, error: null }

  const rawCredential = sessionStorage.getItem(PENDING_GOOGLE_CREDENTIAL_KEY)
  if (!rawCredential) return { linked: false, error: null }

  try {
    const parsed = JSON.parse(rawCredential) as {
      idToken?: string | null
      accessToken?: string | null
      email?: string | null
    }
    if (
      parsed.email &&
      user.email &&
      normalizeEmail(parsed.email) !== normalizeEmail(user.email)
    ) {
      return {
        linked: false,
        error: `Sign in with ${parsed.email} to connect that Google account.`,
      }
    }
    const credential = GoogleAuthProvider.credential(
      parsed.idToken || null,
      parsed.accessToken || null
    )
    await linkWithCredential(user, credential)
    sessionStorage.removeItem(PENDING_GOOGLE_CREDENTIAL_KEY)
    return { linked: true, error: null }
  } catch (err: unknown) {
    const error = err as { code?: string }
    if (
      error.code === 'auth/provider-already-linked' ||
      error.code === 'auth/credential-already-in-use'
    ) {
      sessionStorage.removeItem(PENDING_GOOGLE_CREDENTIAL_KEY)
      return { linked: false, error: null }
    }
    return {
      linked: false,
      error: 'You’re signed in, but we couldn’t connect Google to your account. You can try again later.',
    }
  }
}

export function isGoogleUser(user: User | null): boolean {
  return user?.providerData.some((provider) => provider.providerId === 'google.com') ?? false
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
