'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { COUNTRY_CODES, signupSchema, type SignupInput } from '@/lib/validators/auth'
import {
  COMPANY_SIZES,
  INDUSTRY_CATEGORIES,
  PROFESSIONAL_QUALIFICATIONS,
  PROFESSIONAL_SERVICE_CATEGORIES,
  RECRUITMENT_FUNCTIONS,
} from '@/lib/registration-options'
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
import { getPostLoginPath, getPostSignupPath } from '@/lib/auth-routing'
import { toErrorMessage } from '@/lib/utils'
import { NIGERIAN_STATE_NAMES } from '@/types'
import { AuthDivider, GoogleAuthButton } from './GoogleAuthButton'
import { RegistrationFormHeader, RegistrationLegalCopy } from './RegistrationShell'
import { getBrowserAuthRedirect, withAuthRedirect } from '@/lib/auth-redirect'

type FutureRole = 'professional' | 'recruiter'

export function FutureRoleRegistrationForm({ accountType }: { accountType: FutureRole }) {
  const [showPassword, setShowPassword] = useState(false)
  const [googleUser, setGoogleUser] = useState<User | null>(null)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const isProfessional = accountType === 'professional'
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: accountType, countryCode: '+234' },
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
        window.location.href = getBrowserAuthRedirect() || getPostLoginPath(result.user?.role)
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
      const payload = { ...data, email, role: accountType }
      let firebaseUser = googleUser

      if (!firebaseUser) {
        const submitToFirebase = () => signUp({
          email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          countryCode: data.countryCode,
          role: accountType,
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
        window.location.href = getBrowserAuthRedirect() || getPostSignupPath(body.data?.role)
        return
      }

      if (firebaseUser.emailVerified) {
        window.location.href = getBrowserAuthRedirect() || getPostSignupPath(body.data?.role)
        return
      }

      const { error: verificationEmailError } = await sendVerificationEmail()
      const verificationPath = withAuthRedirect(
        '/verify-email',
        getBrowserAuthRedirect() || getPostSignupPath(body.data?.role)
      )
      const separator = verificationPath.includes('?') ? '&' : '?'
      window.location.href = verificationEmailError
        ? `${verificationPath}${separator}emailStatus=failed&reason=${encodeURIComponent(verificationEmailError)}`
        : verificationPath
    } catch {
      toast.error('An unexpected error occurred. Please try again.')
    }
  }

  const errorClass = (hasError: boolean) => hasError
    ? 'border-amber-400 focus:border-amber-400 focus:ring-amber-200/40'
    : ''

  return (
    <>
      <RegistrationFormHeader
        title={`Create your ${accountType} account`}
        description={isProfessional
          ? 'Share your industry and professional service so relevant opportunities can find you.'
          : 'Tell us about your company and recruitment focus so you can connect with the right talent.'}
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

        <Field label={isProfessional ? 'Email address' : 'Work email address'} error={errors.email?.message}>
          <input
            {...register('email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            readOnly={!!googleUser}
            className={`input-field ${googleUser ? 'bg-slate-50 text-slate-600' : ''} ${errorClass(!!errors.email)}`}
            placeholder={isProfessional ? 'you@example.com' : 'you@company.com'}
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

        <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3.5 sm:rounded-2xl sm:p-5">
          <div className="mb-4">
            <p className="font-display text-sm font-bold text-brand-900">{isProfessional ? 'Professional information' : 'Company information'}</p>
            <p className="mt-1 text-xs text-slate-500">These details are saved to your {accountType} profile.</p>
          </div>

          {isProfessional ? (
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Field label="Industry category" error={errors.industryCategory?.message}>
                <select {...register('industryCategory')} className={`input-field appearance-none ${errorClass(!!errors.industryCategory)}`}>
                  <option value="">Select your industry</option>
                  {INDUSTRY_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Professional service category" error={errors.professionalServiceCategory?.message}>
                <select {...register('professionalServiceCategory')} className={`input-field appearance-none ${errorClass(!!errors.professionalServiceCategory)}`}>
                  <option value="">Select your professional service</option>
                  {PROFESSIONAL_SERVICE_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Current or preferred job title" error={errors.jobTitle?.message}>
                <input {...register('jobTitle')} className={`input-field ${errorClass(!!errors.jobTitle)}`} placeholder="e.g. Civil Engineer" />
              </Field>
              <Field label="Professional qualification" error={errors.qualification?.message}>
                <select {...register('qualification')} className={`input-field appearance-none ${errorClass(!!errors.qualification)}`}>
                  <option value="">Select a qualification</option>
                  {PROFESSIONAL_QUALIFICATIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Years of experience" error={errors.yearsExperience?.message}>
                <input {...register('yearsExperience', { setValueAs: (value) => value === '' ? undefined : Number(value) })} type="number" min={0} max={70} inputMode="numeric" className={`input-field ${errorClass(!!errors.yearsExperience)}`} placeholder="e.g. 5" />
              </Field>
              <Field label="LinkedIn or portfolio URL" optional error={errors.linkedinOrPortfolioUrl?.message}>
                <input {...register('linkedinOrPortfolioUrl')} type="url" inputMode="url" className={`input-field ${errorClass(!!errors.linkedinOrPortfolioUrl)}`} placeholder="https://" />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Field label="Company name" error={errors.companyName?.message}>
                <input {...register('companyName')} autoComplete="organization" className={`input-field ${errorClass(!!errors.companyName)}`} placeholder="e.g. Acme Nigeria Ltd" />
              </Field>
              <Field label="Company size" error={errors.companySize?.message}>
                <select {...register('companySize')} className={`input-field appearance-none ${errorClass(!!errors.companySize)}`}>
                  <option value="">Select company size</option>
                  {COMPANY_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Primary industry served" error={errors.industryCategory?.message}>
                <select {...register('industryCategory')} className={`input-field appearance-none ${errorClass(!!errors.industryCategory)}`}>
                  <option value="">Select the industry you recruit for</option>
                  {INDUSTRY_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Recruitment function" error={errors.recruitmentFunction?.message}>
                <select {...register('recruitmentFunction')} className={`input-field appearance-none ${errorClass(!!errors.recruitmentFunction)}`}>
                  <option value="">Select your recruitment function</option>
                  {RECRUITMENT_FUNCTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Your position" error={errors.position?.message}>
                <input {...register('position')} className={`input-field ${errorClass(!!errors.position)}`} placeholder="e.g. HR Manager" />
              </Field>
              <Field label="Company website" optional error={errors.companyWebsite?.message}>
                <input {...register('companyWebsite')} type="url" inputMode="url" className={`input-field ${errorClass(!!errors.companyWebsite)}`} placeholder="https://" />
              </Field>
            </div>
          )}
        </div>

        <Field label="State" error={errors.state?.message}>
          <select {...register('state')} className={`input-field appearance-none ${errorClass(!!errors.state)}`}>
            <option value="">Select your state</option>
            {NIGERIAN_STATE_NAMES.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </Field>

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
