'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/validators/auth'
import { signIn } from '@/lib/firebase/auth'
import { BrandLogo } from '@/components/layout/BrandLogo'

export default function LoginPage() {
  const router = useRouter()
  const [showPw, setShowPw] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginInput) {
    setServerError('')

    try {
      const { data: result, error } = await signIn(data)

      if (error || !result) {
        setServerError(error?.message ?? 'Login failed')
        return
      }

      const idToken = await result.user.getIdToken()

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      const body = await res.json()

      if (!res.ok) {
        setServerError(body.error ?? 'Failed to establish session')
        return
      }

      if (!result.user.emailVerified) {
        window.location.href = '/verify-email'
        return
      }

      window.location.href = '/dashboard'
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }
      const messages: Record<string, string> = {
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-credential': 'Incorrect email or password',
        'auth/invalid-login-credentials': 'Incorrect email or password',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/user-disabled': 'This account has been disabled',
        'auth/invalid-email': 'Invalid email address',
      }
      setServerError(messages[e?.code ?? ''] ?? e?.message ?? 'Login failed. Please check your credentials.')
    }
  }

  return (
    <div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-7">
          <BrandLogo size="lg" priority imageClassName="mx-auto object-contain" />
        </div>

        <div className="card">
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-center mb-1">Welcome back</h1>
          <p className="text-sm text-slate-500 text-center mb-6 sm:mb-8">Log in to your account to continue</p>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`input-field ${errors.email ? 'border-red-400' : ''}`}
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div className="form-group">
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <span className="text-xs text-brand-500 cursor-pointer">Forgot password?</span>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`input-field pr-14 ${errors.password ? 'border-red-400' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium px-1 py-1 min-h-[44px] flex items-center"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>}
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
        </div>
      </div>
    </div>
  )
}