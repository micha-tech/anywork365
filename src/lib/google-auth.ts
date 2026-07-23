'use client'

import type { User } from 'firebase/auth'
import type { AuthUser } from '@/types'

export interface GoogleAuthExchange {
  user: AuthUser | null
  needsProfile: boolean
  email: string
  firstName: string
  lastName: string
}

export async function exchangeGoogleUser(user: User): Promise<GoogleAuthExchange> {
  const idToken = await user.getIdToken(true)
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  const body = await response.json()

  if (!response.ok || !body.success) {
    throw new Error(body.error || 'We couldn’t complete Google sign-in. Please try again.')
  }

  return {
    user: body.data?.user ?? null,
    needsProfile: body.data?.needsProfile === true,
    email: body.data?.email ?? user.email ?? '',
    firstName: body.data?.firstName ?? '',
    lastName: body.data?.lastName ?? '',
  }
}

export function getGoogleProfile(user: User): {
  email: string
  firstName: string
  lastName: string
} {
  const displayName = user.displayName?.trim() || ''
  const parts = displayName.split(/\s+/).filter(Boolean)
  return {
    email: user.email?.trim().toLowerCase() || '',
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  }
}
