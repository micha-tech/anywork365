'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, type Auth, type User } from 'firebase/auth'
import { toast } from 'sonner'
import { sendVerificationEmail, reloadUser, confirmEmailVerification } from '@/lib/firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type VerificationLinkState = 'idle' | 'applying' | 'verified' | 'error'

function getEmailVerificationCode(): string | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  if (params.get('mode') !== 'verifyEmail') return null

  return params.get('oobCode')
}

function getInitialEmailError(): string | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  if (params.get('emailStatus') !== 'failed') return null

  return params.get('reason') || 'We could not send the verification email automatically. Please use resend.'
}

function waitForCurrentFirebaseUser(fbAuth: Auth): Promise<User | null> {
  if (fbAuth.currentUser) return Promise.resolve(fbAuth.currentUser)

  return new Promise((resolve) => {
    let settled = false
    const timeoutId = window.setTimeout(() => finish(fbAuth.currentUser), 2000)
    let unsubscribe = () => {}

    const finish = (firebaseUser: User | null) => {
      if (settled) return
      settled = true
      if (timeoutId) window.clearTimeout(timeoutId)
      unsubscribe()
      resolve(firebaseUser)
    }

    unsubscribe = onAuthStateChanged(fbAuth, finish, () => finish(null))
  })
}

export default function VerifyEmailPage() {
  const router = useRouter()
  const { user, loading } = useCurrentUser()
  const [checking, setChecking] = useState(false)
  const [polling, setPolling] = useState(true)
  const [verificationCode, setVerificationCode] = useState<string | null>(null)
  const [linkState, setLinkState] = useState<VerificationLinkState>('idle')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [initialEmailError, setInitialEmailError] = useState<string | null>(null)
  const appliedCodeRef = useRef<string | null>(null)

  const refreshSession = useCallback(async () => {
    const fbAuth = getFirebaseAuth()
    const currentUser = await waitForCurrentFirebaseUser(fbAuth)
    if (!currentUser) return false

    await currentUser.reload()
    const freshToken = await currentUser.getIdToken(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: freshToken }),
    })

    return res.ok
  }, [])

  const refreshSessionAndRedirect = useCallback(async () => {
    setPolling(false)
    try {
      await refreshSession()
    } catch {
      // Session refresh is best-effort; dashboard will redirect back if it fails
    }
    router.push('/dashboard')
  }, [refreshSession, router])

  useEffect(() => {
    const code = getEmailVerificationCode()
    const emailError = getInitialEmailError()

    if (emailError) {
      setInitialEmailError(emailError)
      window.history.replaceState(null, '', '/verify-email')
    }

    if (code) {
      setVerificationCode(code)
      setLinkState('applying')
    }
  }, [])

  useEffect(() => {
    if (!verificationCode || appliedCodeRef.current === verificationCode) return

    const code = verificationCode
    appliedCodeRef.current = code
    setPolling(false)
    setLinkState('applying')
    setLinkError(null)

    async function applyVerificationCode() {
      const { error } = await confirmEmailVerification(code)
      window.history.replaceState(null, '', '/verify-email')
      setVerificationCode(null)

      if (error) {
        setLinkState('error')
        setLinkError(error)
        toast.error(error)
        return
      }

      let sessionRefreshed = false
      try {
        sessionRefreshed = await refreshSession()
      } catch {
        sessionRefreshed = false
      }

      setLinkState('verified')
      toast.success('Email verified successfully')

      if (sessionRefreshed) {
        router.push('/dashboard')
      }
    }

    void applyVerificationCode()
  }, [verificationCode, refreshSession, router])

  useEffect(() => {
    if (!loading && !user && !verificationCode && linkState !== 'applying' && linkState !== 'verified') {
      router.push('/login')
      return
    }
  }, [user, loading, verificationCode, linkState, router])

  useEffect(() => {
    if (!polling || verificationCode) return
    const interval = setInterval(async () => {
      const { emailVerified } = await reloadUser()
      if (emailVerified) {
        refreshSessionAndRedirect()
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [polling, verificationCode, refreshSessionAndRedirect])

  async function handleResend() {
    const { error: err } = await sendVerificationEmail()
    if (err) {
      toast.error(err)
    } else {
      setInitialEmailError(null)
      setLinkState('idle')
      setLinkError(null)
      setPolling(true)
      toast.success('Verification email resent')
    }
  }

  async function handleCheckNow() {
    setChecking(true)
    const { emailVerified, error: err } = await reloadUser()
    setChecking(false)
    if (err) {
      toast.error('Couldn\u2019t check your status. Please try again.')
      return
    }
    if (emailVerified) {
      refreshSessionAndRedirect()
    } else {
      toast.error('Email not verified yet. Check your inbox and click the link.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-surface-base flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 text-6xl">✉️</div>

        <div className="card">
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-center mb-1">Verify your email</h1>
          <p className="text-sm text-slate-500 text-center mt-3 mb-2 leading-relaxed">
            We sent a verification email to <strong className="text-slate-900">{user?.email}</strong>
          </p>
          <p className="text-sm text-slate-500 text-center mb-6">
            {linkState === 'applying'
              ? 'Verifying your email link...'
              : linkState === 'verified'
                ? 'Your email has been verified.'
                : 'Click the link in the email to activate your account.'}
          </p>

          {linkState === 'error' && linkError && (
            <p className="text-sm text-amber-600 text-center mb-6 leading-relaxed">
              {linkError}
            </p>
          )}

          {initialEmailError && linkState !== 'error' && (
            <p className="text-sm text-amber-600 text-center mb-6 leading-relaxed">
              {initialEmailError}
            </p>
          )}

          <div className="space-y-3">
            {linkState === 'verified' && !user ? (
              <button
                onClick={() => router.push('/login')}
                className="btn-primary w-full py-3 text-base justify-center"
              >
                Log in to continue
              </button>
            ) : (
              <button
                onClick={handleCheckNow}
                disabled={checking || linkState === 'applying'}
                className="btn-primary w-full py-3 text-base justify-center"
              >
                {linkState === 'applying' ? 'Verifying...' : checking ? 'Checking...' : 'I\'ve verified, continue'}
              </button>
            )}

            <button
              onClick={handleResend}
              disabled={linkState === 'applying'}
              className="w-full py-3 text-sm text-brand-500 font-medium bg-transparent border border-slate-200 rounded-xl hover:bg-surface-base transition-colors"
            >
              Resend verification email
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center mt-6">
            Didn&apos;t receive the email? Check your spam folder.
          </p>
        </div>
      </div>
    </div>
  )
}
