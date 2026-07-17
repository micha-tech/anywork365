'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthUser } from '@/types'
import { logoutCurrentUser } from '@/lib/clientLogout'

interface AuthState {
  user: AuthUser | null
  loading: boolean
}

export function useAuth() {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    // Fetch current session from server
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setState({ user: data?.data ?? null, loading: false })
      })
      .catch(() => setState({ user: null, loading: false }))
  }, [])

  const logout = useCallback(async () => {
    await logoutCurrentUser()
    setState({ user: null, loading: false })
    router.push('/')
  }, [router])

  const requireAuth = useCallback(() => {
    if (!state.loading && !state.user) {
      router.push('/login')
    }
  }, [state, router])

  return { ...state, logout, requireAuth }
}
