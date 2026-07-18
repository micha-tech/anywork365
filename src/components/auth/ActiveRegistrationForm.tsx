'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema, type SignupInput, COUNTRY_CODES } from '@/lib/validators/auth'
import { sendVerificationEmail, signUp } from '@/lib/firebase/auth'
import { toErrorMessage } from '@/lib/utils'
import { BUSINESS_CATEGORY_GROUPS, NIGERIAN_STATE_NAMES } from '@/types'
import { RegistrationFormHeader, RegistrationLegalCopy } from './RegistrationShell'

type ActiveRegistrationFormProps = {
  accountType: 'client' | 'artisan'
}

export function ActiveRegistrationForm({ accountType }: ActiveRegistrationFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const backendRole = accountType === 'artisan' ? 'vendor' : 'client'
  const isArtisan = accountType === 'artisan'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: backendRole, countryCode: '+234' },
  })

  async function onSubmit(data: SignupInput) {
    try {
      const email = data.email.trim().toLowerCase()
      const payload = { ...data, email, role: backendRole }
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

      let { data: result, user: firebaseUser, error } = await submitToFirebase()

      if (error?.code === 'auth/email-already-in-use') {
        const cleanup = await fetch('/api/auth/cleanup-stale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const cleanupBody = await cleanup.json()
        if (!cleanup.ok || !cleanupBody.success) {
          toast.error(cleanupBody.error || 'An account with this email already exists. Please log in.')
          return
        }
        ;({ data: result, user: firebaseUser, error } = await submitToFirebase())
      }

      if (error || !result || !firebaseUser) {
        toast.error(toErrorMessage(error))
        return
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
          <input {...register('email')} type="email" inputMode="email" autoComplete="email" className={`input-field ${errorClass(!!errors.email)}`} placeholder="you@example.com" />
        </Field>

        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
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
          <Field label="State" error={errors.city?.message}>
            <select {...register('city')} className={`input-field appearance-none ${errorClass(!!errors.city)}`}>
              <option value="">Select your state</option>
              {NIGERIAN_STATE_NAMES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </Field>
          <Field label="11-digit NIN" optional error={errors.nin?.message}>
            <input {...register('nin')} type="text" inputMode="numeric" maxLength={11} className={`input-field ${errorClass(!!errors.nin)}`} placeholder="Optional" />
          </Field>
        </div>

        {isArtisan && (
          <Field label="Primary service category" error={errors.category?.message}>
            <select {...register('category')} className={`input-field appearance-none ${errorClass(!!errors.category)}`}>
              <option value="">Select the service you provide</option>
              {BUSINESS_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
        )}

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

        <button type="submit" disabled={isSubmitting} className="btn-primary mt-2 w-full py-3.5 text-base">
          {isSubmitting ? 'Creating account...' : `Create ${accountType} account`}
        </button>
      </form>

      <RegistrationLegalCopy />
    </>
  )
}

function Field({ label, optional, error, children }: { label: string; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-amber-700">{error}</p>}
    </div>
  )
}
