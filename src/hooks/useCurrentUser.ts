'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AuthUser } from '@/types'

const CURRENT_USER_CHANGED_EVENT = 'aw365:current-user-changed'

interface CurrentUserState {
  user: AuthUser | null
  loading: boolean
}

interface CurrentUserResult extends CurrentUserState {
  refresh: () => Promise<AuthUser | null>
}

export function useCurrentUser(): CurrentUserResult {
  const [state, setState] = useState<CurrentUserState>({ user: null, loading: true })

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = response.ok ? await response.json() : null
      const user = data?.data ?? null
      setState({ user, loading: false })
      return user
    } catch {
      setState({ user: null, loading: false })
      return null
    }
  }, [])

  useEffect(() => {
    void refresh()

    const refreshCurrentUser = () => {
      void refresh()
    }

    window.addEventListener(CURRENT_USER_CHANGED_EVENT, refreshCurrentUser)
    window.addEventListener('focus', refreshCurrentUser)

    return () => {
      window.removeEventListener(CURRENT_USER_CHANGED_EVENT, refreshCurrentUser)
      window.removeEventListener('focus', refreshCurrentUser)
    }
  }, [refresh])

  return { ...state, refresh }
}

export function notifyCurrentUserChanged(): void {
  window.dispatchEvent(new Event(CURRENT_USER_CHANGED_EVENT))
}

// Derive initials from first + last name, e.g. "Michael Eze" → "ME"
export function getInitialsFromUser(user: AuthUser | null): string {
  if (!user) return '??'
  const first = user.firstName?.[0] ?? ''
  const last  = user.lastName?.[0] ?? ''
  if (!first && !last) return '??'
  if (!last) return `${first}${first}`.toUpperCase()
  return `${first}${last}`.toUpperCase()
}
