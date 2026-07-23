'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema, type SignupInput, COUNTRY_CODES } from '@/lib/validators/auth'
import {
  isGoogleUser,
  onAuthChange,
  sendVerificationEmail,
  signIn,
  signInWithGoogle,
  signOut as signOutFirebase,
  signUp,
} from '@/lib/firebase/auth'
import { exchangeGoogleUser, getGoogleProfile } from '@/lib/google-auth'
import { getPostLoginPath } from '@/lib/auth-routing'
import { toErrorMessage } from '@/lib/utils'
import { BUSINESS_CATEGORY_GROUPS, NIGERIAN_STATE_NAMES } from '@/types'
import { AuthDivider, GoogleAuthButton } from './GoogleAuthButton'
import { RegistrationFormHeader, RegistrationLegalCopy } from './RegistrationShell'

type ActiveRegistrationFormProps = {
  accountType: 'client' | 'artisan'
}

export function ActiveRegistrationForm({ accountType }: ActiveRegistrationFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [googleUser, setGoogleUser] = useState<User | null>(null)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const backendRole = accountType
  const isArtisan = accountType === 'artisan'

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: backendRole, countryCode: '+234' },
  })

  const applyGoogleUser = useCallback((user: User) => {
    const profile = getGoogleProfile(user)
    setGoogleUser(user)
    setValue('email', profile.email, { shouldValidate: true })
    if (profile.firstName) setValue('firstName', profile.firstName, { shouldValidate: true })
    if (profile.lastName) setValue('lastName', profile.lastName, { shouldValidate: true })
    setValue('password', 'GoogleOAuth1', { shouldValidate: true })
    setValue('confirmPassword', 'GoogleOAuth1', { shouldValidate: true })
  }, [setValue])

  useEffect(() => {
    try {
      return onAuthChange((user) => {
        if (
          sessionStorage.getItem('anywork365_google_signup') === '1' &&
          user &&
          isGoogleUser(user)
        ) {
          applyGoogleUser(user)
        }
      })
    } catch {
      return undefined
    }
  }, [applyGoogleUser])

  async function handleGoogleSignUp() {
    setGoogleSubmitting(true)
    try {
      const { user, error } = await signInWithGoogle()
      if (error || !user) {
        if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') {
          toast.error(error?.message || 'We couldn’t continue with Google.')
        }
        return
      }

      const result = await exchangeGoogleUser(user)
      if (!result.needsProfile) {
        window.location.href = getPostLoginPath(result.user?.role)
        return
      }

      applyGoogleUser(user)
      sessionStorage.setItem('anywork365_google_signup', '1')
      toast.success('Google connected. Complete the remaining details to finish signing up.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We couldn’t continue with Google.')
    } finally {
      setGoogleSubmitting(false)
    }
  }

  async function switchToEmailSignup() {
    await signOutFirebase().catch(() => undefined)
    sessionStorage.removeItem('anywork365_google_signup')
    setGoogleUser(null)
    setValue('email', '')
    setValue('password', '')
    setValue('confirmPassword', '')
  }

  async function onSubmit(data: SignupInput) {
    try {
      const email = data.email.trim().toLowerCase()
      const payload = { ...data, email, role: backendRole }
      let firebaseUser = googleUser

      if (!firebaseUser) {
        const submitToFirebase = () => signUp({
          email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          countryCode: data.countryCode,
          nin: data.nin || undefined,
          role: backendRole,
        })

        const signupResult = await submitToFirebase()

        if (signupResult.error?.code === 'auth/email-already-in-use') {
          const existingSignIn = await signIn({ email, password: data.password })
          if (existingSignIn.error || !existingSignIn.data?.user) {
            toast.error('An account with this email already exists. Log in or continue with Google.')
            return
          }
          firebaseUser = existingSignIn.data.user
        } else {
          if (signupResult.error || !signupResult.data || !signupResult.user) {
            toast.error(toErrorMessage(signupResult.error))
            return
          }
          firebaseUser = signupResult.user
        }
      }

      const idToken = await firebaseUser.getIdToken()
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, ...payload }),
      })
      const body = await response.json()

      if (!response.ok) {
        toast.error(body.error ?? 'Failed to complete signup')
        return
      }

      if (googleUser) {
        sessionStorage.removeItem('anywork365_google_signup')
        window.location.href = getPostLoginPath(body.data?.role)
        return
      }

      if (firebaseUser.emailVerified) {
        window.location.href = getPostLoginPath(body.data?.role)
        return
      }

      const { error: verificationEmailError } = await sendVerificationEmail()
      window.location.href = verificationEmailError
        ? `/verify-email?emailStatus=failed&reason=${encodeURIComponent(verificationEmailError)}`
        : '/verify-email'
    } catch {
      toast.error('An unexpected error occurred. Please try again.')
    }
  }

  const errorClass = (hasError: boolean) => hasError ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-200/40' : ''

  return (
    <>
      <RegistrationFormHeader
        title={isArtisan ? 'Create your artisan account' : 'Create your client account'}
        description={isArtisan
          ? 'Tell us who you are and the primary service you provide.'
          : 'Enter your details to start finding and booking trusted people.'}
      />

      {googleUser ? (
        <div className="mb-5 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
          <p className="text-sm font-semibold text-brand-800">Continue with Google</p>
          <p className="mt-0.5 truncate text-xs text-brand-700">{googleUser.email}</p>
          <button
            type="button"
            onClick={switchToEmailSignup}
            className="mt-2 text-xs font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4"
          >
            Use email instead
          </button>
        </div>
      ) : (
        <>
          <GoogleAuthButton onClick={handleGoogleSignUp} loading={googleSubmitting} />
          <AuthDivider />
        </>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <input type="hidden" {...register('role')} />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message}>
            <input {...register('firstName')} autoComplete="given-name" className={`input-field ${errorClass(!!errors.firstName)}`} placeholder="Emeka" />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <input {...register('lastName')} autoComplete="family-name" className={`input-field ${errorClass(!!errors.lastName)}`} placeholder="Obi" />
          </Field>
        </div>

        <Field label="Email address" error={errors.email?.message}>
          <input
            {...register('email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            readOnly={!!googleUser}
            className={`input-field ${googleUser ? 'bg-slate-50 text-slate-600' : ''} ${errorClass(!!errors.email)}`}
            placeholder="you@example.com"
          />
        </Field>

        <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-2.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
          <Field label="Country" error={errors.countryCode?.message}>
            <select {...register('countryCode')} className={`input-field appearance-none ${errorClass(!!errors.countryCode)}`}>
              {COUNTRY_CODES.map((country) => <option key={country.code} value={country.code}>{country.code}</option>)}
            </select>
          </Field>
          <Field label="Phone number" error={errors.phone?.message}>
            <input {...register('phone')} type="tel" inputMode="tel" autoComplete="tel" className={`input-field ${errorClass(!!errors.phone)}`} placeholder="800 000 0000" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="State" error={errors.state?.message}>
            <select {...register('state')} className={`input-field appearance-none ${errorClass(!!errors.state)}`}>
              <option value="">Select your state</option>
              {NIGERIAN_STATE_NAMES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </Field>
          <Field label="11-digit NIN" optional error={errors.nin?.message}>
            <input {...register('nin')} type="text" inputMode="numeric" maxLength={11} className={`input-field ${errorClass(!!errors.nin)}`} placeholder="Optional" />
          </Field>
        </div>

        {isArtisan && (
          <Field label="Primary service category" error={errors.artisanServiceCategory?.message}>
            <select {...register('artisanServiceCategory')} className={`input-field appearance-none ${errorClass(!!errors.artisanServiceCategory)}`}>
              <option value="">Select the service you provide</option>
              {BUSINESS_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
        )}

        {!googleUser && (
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="Password" error={errors.password?.message}>
              <div className="relative">
                <input {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`input-field pr-16 ${errorClass(!!errors.password)}`} placeholder="Min. 8 characters" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 flex min-h-[40px] -translate-y-1/2 items-center px-2 text-xs font-bold text-brand-600">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
            <Field label="Confirm password" error={errors.confirmPassword?.message}>
              <input {...register('confirmPassword')} type="password" autoComplete="new-password" className={`input-field ${errorClass(!!errors.confirmPassword)}`} placeholder="Repeat password" />
            </Field>
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="btn-primary mt-2 w-full py-3.5 text-base">
          {isSubmitting ? 'Creating account...' : googleUser ? 'Complete signup' : `Create ${accountType} account`}
        </button>
      </form>

      <RegistrationLegalCopy />
    </>
  )
}

function Field({ label, optional, error, children }: { label: string; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 sm:mb-5">
      <label className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-amber-700">{error}</p>}
    </div>
  )
}
