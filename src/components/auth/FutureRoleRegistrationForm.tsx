'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { COUNTRY_CODES } from '@/lib/validators/auth'
import { NIGERIAN_STATE_NAMES } from '@/types'
import { RegistrationFormHeader, RegistrationLegalCopy } from './RegistrationShell'

type FutureRole = 'professional' | 'recruiter'

const professionalFields = [
  { name: 'profession', label: 'Professional field', type: 'select', options: ['Accounting & Finance', 'Architecture', 'Consulting', 'Education & Training', 'Engineering', 'Healthcare', 'Information Technology', 'Law & Legal Services', 'Media & Communications', 'Project Management', 'Other'] },
  { name: 'qualification', label: 'Highest qualification', type: 'select', options: ['Diploma / OND', 'HND', 'Bachelor’s degree', 'Postgraduate diploma', 'Master’s degree', 'Doctorate', 'Professional certification', 'Other'] },
  { name: 'jobTitle', label: 'Current or preferred job title', type: 'text', placeholder: 'e.g. Civil Engineer' },
  { name: 'yearsExperience', label: 'Years of experience', type: 'number', placeholder: 'e.g. 5' },
] as const

const recruiterFields = [
  { name: 'organisationName', label: 'Organisation name', type: 'text', placeholder: 'e.g. Acme Nigeria Ltd' },
  { name: 'organisationType', label: 'Organisation type', type: 'select', options: ['Private company', 'Public company', 'Recruitment agency', 'Non-profit organisation', 'Government organisation', 'Small business', 'Other'] },
  { name: 'position', label: 'Your position', type: 'text', placeholder: 'e.g. HR Manager' },
  { name: 'companySize', label: 'Organisation size', type: 'select', options: ['1–10 employees', '11–50 employees', '51–200 employees', '201–500 employees', '501+ employees'] },
] as const

export function FutureRoleRegistrationForm({ accountType }: { accountType: FutureRole }) {
  const [showPassword, setShowPassword] = useState(false)
  const isProfessional = accountType === 'professional'
  const fields = isProfessional ? professionalFields : recruiterFields

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (data.get('password') !== data.get('confirmPassword')) {
      toast.error('Passwords do not match')
      return
    }
    toast.success(`${isProfessional ? 'Professional' : 'Recruiter'} registration page is ready. Account activation will be connected in the next phase.`)
  }

  return (
    <>
      <RegistrationFormHeader
        title={`Create your ${accountType} account`}
        description={isProfessional
          ? 'Share your professional background so relevant employers and opportunities can find you.'
          : 'Tell us about you and your organisation so you can connect with the right talent.'}
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <NativeField label="First name"><input name="firstName" required autoComplete="given-name" className="input-field" placeholder="Emeka" /></NativeField>
          <NativeField label="Last name"><input name="lastName" required autoComplete="family-name" className="input-field" placeholder="Obi" /></NativeField>
        </div>

        <NativeField label={isProfessional ? 'Email address' : 'Work email address'}>
          <input name="email" required type="email" inputMode="email" autoComplete="email" className="input-field" placeholder={isProfessional ? 'you@example.com' : 'you@company.com'} />
        </NativeField>

        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
          <NativeField label="Country">
            <select name="countryCode" defaultValue="+234" className="input-field appearance-none">
              {COUNTRY_CODES.map((country) => <option key={country.code} value={country.code}>{country.code}</option>)}
            </select>
          </NativeField>
          <NativeField label="Phone number"><input name="phone" required type="tel" inputMode="tel" autoComplete="tel" className="input-field" placeholder="800 000 0000" /></NativeField>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
          <div className="mb-4">
            <p className="font-display text-sm font-bold text-brand-900">{isProfessional ? 'Professional information' : 'Organisation information'}</p>
            <p className="mt-1 text-xs text-slate-500">These details help us tailor your account and opportunities.</p>
          </div>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {fields.map((field) => (
              <NativeField key={field.name} label={field.label}>
                {field.type === 'select' ? (
                  <select name={field.name} required defaultValue="" className="input-field appearance-none">
                    <option value="">Select an option</option>
                    {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input name={field.name} required type={field.type} min={field.type === 'number' ? 0 : undefined} inputMode={field.type === 'number' ? 'numeric' : undefined} className="input-field" placeholder={field.placeholder} />
                )}
              </NativeField>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <NativeField label="State">
            <select name="state" required defaultValue="" className="input-field appearance-none">
              <option value="">Select your state</option>
              {NIGERIAN_STATE_NAMES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </NativeField>
          <NativeField label={isProfessional ? 'LinkedIn or portfolio URL' : 'Organisation website'} optional>
            <input name="website" type="url" inputMode="url" className="input-field" placeholder="https://" />
          </NativeField>
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <NativeField label="Password">
            <div className="relative">
              <input name="password" required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="input-field pr-16" placeholder="Min. 8 characters" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 flex min-h-[40px] -translate-y-1/2 items-center px-2 text-xs font-bold text-brand-600">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </NativeField>
          <NativeField label="Confirm password"><input name="confirmPassword" required minLength={8} type="password" autoComplete="new-password" className="input-field" placeholder="Repeat password" /></NativeField>
        </div>

        <button type="submit" className="btn-primary mt-2 w-full py-3.5 text-base">
          Create {accountType} account
        </button>
      </form>

      <RegistrationLegalCopy />
    </>
  )
}

function NativeField({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
    </div>
  )
}
