'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/validators/auth'
import { linkPendingGoogleCredential, resetPassword, signIn, signInWithGoogle } from '@/lib/firebase/auth'
import { exchangeGoogleUser } from '@/lib/google-auth'
import { getPostLoginPath } from '@/lib/auth-routing'
import { toErrorMessage } from '@/lib/utils'
import { BrandWordmark } from '@/components/layout/BrandLogo'
import { AuthDivider, GoogleAuthButton } from '@/components/auth/GoogleAuthButton'

export default function LoginPage() {
  const [showPw, setShowPw] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function handleForgotPassword() {
    const emailIsValid = await trigger('email')
    if (!emailIsValid) {
      toast.error('Enter your email address first.')
      return
    }

    setResetSubmitting(true)
    try {
      const { error } = await resetPassword(getValues('email'))
      if (error) {
        toast.error(error)
        return
      }

      toast.success('Password reset email sent. Check your inbox.')
    } catch (error) {
      toast.error(toErrorMessage(error))
    } finally {
      setResetSubmitting(false)
    }
  }

  async function onSubmit(data: LoginInput) {
    try {
      const { data: result, error } = await signIn(data)

      if (error || !result) {
        toast.error(toErrorMessage(error))
        return
      }

      const googleLink = await linkPendingGoogleCredential(result.user)
      if (googleLink.error) toast.error(googleLink.error)

      const idToken = await result.user.getIdToken(true)

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      const body = await res.json()

      if (!res.ok) {
        toast.error(body.error ?? 'Failed to establish session')
        return
      }

      if (!result.user.emailVerified) {
        window.location.href = '/verify-email'
        return
      }

      window.location.href = getPostLoginPath(body.data?.role)
    } catch (err: unknown) {
      toast.error(toErrorMessage(err))
    }
  }

  async function handleGoogleSignIn() {
    setGoogleSubmitting(true)
    try {
      const { user, error } = await signInWithGoogle()
      if (error || !user) {
        if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') {
          toast.error(error?.message || 'We couldn’t sign you in with Google.')
        }
        return
      }

      const result = await exchangeGoogleUser(user)
      if (result.needsProfile) {
        sessionStorage.setItem('anywork365_google_signup', '1')
        toast.success('Google connected. Choose your account type to finish signing up.')
        window.location.href = '/signup'
        return
      }

      window.location.href = getPostLoginPath(result.user?.role)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We couldn’t sign you in with Google.')
    } finally {
      setGoogleSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[linear-gradient(135deg,#ffffff_0%,#FAFBFC_52%,#EEF1F5_100%)] flex flex-col items-center justify-start px-4 py-6 sm:justify-center sm:py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center sm:mb-8">
          <BrandWordmark priority className="w-[245px] sm:w-[285px]" />
        </div>

        <div className="card p-5 sm:p-8">
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-center mb-1">Welcome back</h1>
          <p className="text-sm text-slate-500 text-center mb-6 sm:mb-8">Log in to find artisans, view jobs and manage your bookings.</p>

          <GoogleAuthButton onClick={handleGoogleSignIn} loading={googleSubmitting} />
          <AuthDivider />

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`input-field ${errors.email ? 'border-amber-300' : ''}`}
              />
              {errors.email && <p className="mt-1.5 text-xs text-amber-600">{errors.email.message}</p>}
            </div>

            <div className="form-group">
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetSubmitting}
                  className="text-xs font-semibold text-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetSubmitting ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`input-field pr-14 ${errors.password ? 'border-amber-300' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium px-1 py-1 min-h-[44px] flex items-center"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-amber-600">{errors.password.message}</p>}
            </div>

            <div className="flex items-center gap-2 mb-6">
              <input type="checkbox" id="remember" className="w-4 h-4 accent-brand-500" />
              <label htmlFor="remember" className="text-sm text-slate-500 cursor-pointer" style={{ margin: 0 }}>
                Remember me
              </label>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base justify-center">
              {isSubmitting ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-brand-500 font-medium">Sign up</Link>
          </p>
          <Link href="/signup" className="btn-ghost mt-4 w-full justify-center sm:hidden">
            Create account
          </Link>
        </div>
      </div>
    </div>
  )
}
