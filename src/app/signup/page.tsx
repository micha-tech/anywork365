'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema, type SignupInput, COUNTRY_CODES } from '@/lib/validators/auth'
import { signUp } from '@/lib/firebase/auth'
import { NIGERIAN_STATE_NAMES } from '@/types'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/layout/BrandLogo'

export default function SignupPage() {
  const [showPw, setShowPw] = useState(false)
  const [role, setRole] = useState<'client' | 'vendor'>('client')
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema), defaultValues: { role: 'client', countryCode: '+234' } })

  function handleRoleSelect(r: 'client' | 'vendor') {
    setRole(r)
    setValue('role', r)
  }

  async function onSubmit(data: SignupInput) {
    setServerError('')

    try {
      const { data: result, user: fbUser, error } = await signUp({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        countryCode: data.countryCode,
        nin: data.nin,
        role: data.role,
      })

      if (error || !result || !fbUser) {
        const messages: Record<string, string> = {
          'auth/email-already-in-use': 'An account with this email already exists',
          'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
          'auth/invalid-email': 'Invalid email address',
        }
        setServerError(messages[error?.code ?? ''] ?? 'Signup failed. Please try again.')
        return
      }

      const idToken = await fbUser.getIdToken()

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, ...data }),
      })

      const body = await res.json()

      if (!res.ok) {
        setServerError(body.error ?? 'Failed to complete signup')
        return
      }

      window.location.href = '/verify-email'
    } catch (err: unknown) {
      setServerError('An unexpected error occurred. Please try again.')
    }
  }

  return (
    <div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-7">
          <BrandLogo size="lg" priority imageClassName="mx-auto object-contain" />
        </div>

        <div className="card">
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-center mb-1">Create your account</h1>
          <p className="text-sm text-slate-500 text-center mb-6">Join Nigeria&apos;s leading work platform</p>

          {serverError && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 animate-toast-in">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-amber-800">{serverError}</p>
            </div>
          )}

          <div className="mb-5">
            <p className="label mb-2">I want to...</p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {(['client', 'vendor'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleSelect(r)}
                  className={cn(
                    'py-3 px-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[52px]',
                    role === r
                      ? 'border-brand-500 bg-surface-50 text-brand-600'
                      : 'border-slate-200 bg-surface-base text-slate-500'
                  )}
                >
                  {r === 'client' ? '👤 Register as User' : '🛠️ Register as Vendor'}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">First name</label>
                <input {...register('firstName')} className={`input-field ${errors.firstName ? 'border-amber-300' : ''}`} placeholder="Emeka" autoComplete="given-name" />
                {errors.firstName && <p className="mt-1 text-xs text-amber-600">{errors.firstName.message}</p>}
              </div>
              <div className="form-group">
                <label className="label">Last name</label>
                <input {...register('lastName')} className={`input-field ${errors.lastName ? 'border-amber-300' : ''}`} placeholder="Obi" autoComplete="family-name" />
                {errors.lastName && <p className="mt-1 text-xs text-amber-600">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="form-group">
              <label className="label">Email address</label>
              <input {...register('email')} type="email" inputMode="email" autoComplete="email" className={`input-field ${errors.email ? 'border-amber-300' : ''}`} placeholder="you@example.com" />
              {errors.email && <p className="mt-1 text-xs text-amber-600">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="form-group col-span-1">
                <label className="label">Country</label>
                <select {...register('countryCode')} className="input-field appearance-none">
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </div>
              <div className="form-group col-span-2">
                <label className="label">Phone number</label>
                <input {...register('phone')} type="tel" inputMode="tel" autoComplete="tel" className={`input-field ${errors.phone ? 'border-amber-300' : ''}`} placeholder="800 000 0000" />
                {errors.phone && <p className="mt-1 text-xs text-amber-600">{errors.phone.message}</p>}
              </div>
            </div>

            <div className="form-group">
              <label className="label">11-digit NIN</label>
              <input {...register('nin')} type="text" inputMode="numeric" className={`input-field ${errors.nin ? 'border-amber-300' : ''}`} placeholder="00 0000 0000" />
              {errors.nin && <p className="mt-1 text-xs text-amber-600">{errors.nin.message}</p>}
            </div>

            <div className="form-group">
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  className={`input-field pr-14 ${errors.password ? 'border-amber-300' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium px-1 min-h-[44px] flex items-center"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-amber-600">{errors.password.message}</p>}
            </div>

            <div className="form-group">
              <label className="label">Confirm password</label>
              <input {...register('confirmPassword')} type="password" autoComplete="new-password" className={`input-field ${errors.confirmPassword ? 'border-amber-300' : ''}`} placeholder="Repeat your password" />
              {errors.confirmPassword && <p className="mt-1 text-xs text-amber-600">{errors.confirmPassword.message}</p>}
            </div>

            <div className="form-group">
              <label className="label">State</label>
              <select {...register('city')} className={`input-field appearance-none ${errors.city ? 'border-amber-300' : ''}`}>
                <option value="">Select your state</option>
                {NIGERIAN_STATE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.city && <p className="mt-1 text-xs text-amber-600">{errors.city.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base justify-center mt-2">
              {isSubmitting ? 'Creating account...' : 'Create account →'}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed">
            By signing up you agree to our{' '}
            <span className="text-brand-500">Terms of Service</span> and{' '}
            <span className="text-brand-500">Privacy Policy</span>
          </p>
          <p className="text-sm text-slate-500 text-center mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-500 font-medium">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}