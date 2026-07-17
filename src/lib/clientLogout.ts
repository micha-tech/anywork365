'use client'

import { signOut as signOutFirebase } from '@/lib/firebase/auth'
import { notifyCurrentUserChanged } from '@/hooks/useCurrentUser'

export async function logoutCurrentUser(): Promise<void> {
  try {
    await signOutFirebase()
  } catch {
    // Server-session logout should still happen if Firebase is unavailable.
  }

  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    notifyCurrentUserChanged()
  }
}
