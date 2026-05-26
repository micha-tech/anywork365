import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword as fUpdatePassword,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { getFirebaseAuth } from './client'
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

export async function signUp({
  email,
  password,
}: SignUpData) {
  const fbAuth = requireFirebase()
  try {
    const cred = await createUserWithEmailAndPassword(fbAuth, email, password)

    await sendEmailVerification(cred.user)

    const authUser: AuthUser = { id: cred.user.uid, email, firstName: '', lastName: '', role: 'client' }
    return { data: authUser, user: cred.user, error: null }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    return { data: null, error: { code: e?.code, message: 'Signup failed. Please try again.' } }
  }
}

export async function sendVerificationEmail(): Promise<{ error: string | null }> {
  const fbAuth = requireFirebase()
  const user = fbAuth.currentUser
  if (!user) return { error: 'Not authenticated' }
  try {
    await sendEmailVerification(user)
    return { error: null }
  } catch {
    return { error: 'Failed to send verification email. Please try again.' }
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
    const cred = await signInWithEmailAndPassword(fbAuth, email, password)
    const authUser: AuthUser = {
      id: cred.user.uid,
      email,
      firstName: '',
      lastName: '',
      role: 'client',
    }
    return { data: { user: cred.user, profile: authUser }, error: null }
  } catch (err: unknown) {
    const e = err as { code?: string}
    return { data: null, error: { code: e?.code, message: 'Login failed. Please try again.' } }
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