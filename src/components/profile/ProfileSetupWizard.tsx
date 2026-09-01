'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui'
import { BrandWordmark } from '@/components/layout/BrandLogo'
import { notifyCurrentUserChanged } from '@/hooks/useCurrentUser'
import { getLocalGovernments } from '@/lib/nigeria-locations'
import {
  INDUSTRY_CATEGORIES,
  PROFESSIONAL_QUALIFICATIONS,
  PROFESSIONAL_SERVICE_CATEGORIES,
} from '@/lib/registration-options'
import {
  BUSINESS_CATEGORY_GROUPS,
  NIGERIAN_STATE_NAMES,
  type NigerianState,
  type ProfessionalCertification,
  type ProfessionalWorkExperience,
} from '@/types'

type SetupRole = 'artisan' | 'professional'

interface SetupUser {
  id: string
  role: SetupRole
  firstName: string
  lastName: string
  email: string
  phone: string
  state: string
  lga: string
  address: string
  bio: string
  avatarUrl?: string | null
}

interface ArtisanSetup {
  businessName: string
  category: string
  businessContact: string
  description: string
  location: string
  state: string
  lga: string
  yearsOfExperience: number | null
}

interface ProfessionalSetup {
  industryCategory: string
  professionalServiceCategory: string
  jobTitle: string
  qualification: string
  yearsExperience: number
  linkedinOrPortfolioUrl: string
  coverImageUrl: string
  schoolName: string
  certifications: ProfessionalCertification[]
  workExperience: ProfessionalWorkExperience[]
}

interface SetupData {
  role: SetupRole
  user: SetupUser
  artisan?: ArtisanSetup | null
  professional?: ProfessionalSetup | null
}

const CURRENT_YEAR = new Date().getFullYear()
const MAX_SOURCE_IMAGE_SIZE = 15 * 1024 * 1024

async function optimizeLargeImage(file: File, maxUploadSize: number, maxDimension: number): Promise<File> {
  if (file.size <= maxUploadSize) return file

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Could not read this image'))
      element.src = objectUrl
    })
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare this image')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84))
    if (!blob || blob.size > maxUploadSize) throw new Error('This image is still too large after optimisation')
    return new File([blob], `profile-${Date.now()}.webp`, { type: 'image/webp' })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function blankExperience(): ProfessionalWorkExperience {
  return { jobTitle: '', employer: '', startYear: CURRENT_YEAR, current: true, description: '' }
}

function initials(user: SetupUser): string {
  return `${user.firstName[0] || ''}${user.lastName[0] || user.firstName[1] || ''}`.toUpperCase() || 'AW'
}

export function ProfileSetupWizard() {
  const router = useRouter()
  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<SetupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    fetch('/api/profile/setup', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(body.error || 'Could not load profile setup')
        return body.data as SetupData
      })
      .then((setup) => {
        setData(setup)
        const states = completionStates(setup)
        const firstIncomplete = states.findIndex((complete) => !complete)
        if (firstIncomplete === -1) setFinished(true)
        else setStep(firstIncomplete)
      })
      .catch((error: Error) => {
        toast.error(error.message)
        router.replace('/login')
      })
      .finally(() => setLoading(false))
  }, [router])

  const steps = useMemo(() => data ? stepDefinitions(data.role) : [], [data])
  const states = useMemo(() => data ? completionStates(data) : [], [data])
  const completedCount = states.filter(Boolean).length
  const progress = finished ? 100 : steps.length ? Math.round((completedCount / steps.length) * 100) : 0

  function advance(updated: SetupData) {
    setData(updated)
    const updatedStates = completionStates(updated)
    const nextAfterCurrent = updatedStates.findIndex((complete, index) => index > step && !complete)
    const nextIncomplete = nextAfterCurrent >= 0
      ? nextAfterCurrent
      : updatedStates.findIndex((complete) => !complete)

    if (nextIncomplete === -1) {
      setFinished(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setStep(nextIncomplete)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function patchSetup(payload: Record<string, unknown>): Promise<boolean> {
    setSaving(true)
    try {
      const response = await fetch('/api/profile/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok || !body.success) {
        toast.error(body.error || 'Could not save this step')
        return false
      }
      notifyCurrentUserChanged()
      return true
    } catch {
      toast.error('We could not connect. Check your connection and try again.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file || !data) return
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a JPEG, PNG or WebP image')
      return
    }
    if (file.size > MAX_SOURCE_IMAGE_SIZE) {
      toast.error('Choose a profile photo smaller than 15MB')
      return
    }
    setSaving(true)
    try {
      const uploadFile = await optimizeLargeImage(file, 5 * 1024 * 1024, 512)
      const form = new FormData()
      form.append('avatar', uploadFile)
      const response = await fetch('/api/upload/avatar', { method: 'POST', body: form })
      const body = await response.json()
      if (!response.ok || !body.success) {
        toast.error(body.error || 'Could not upload your photo')
        return
      }
      notifyCurrentUserChanged()
      advance({ ...data, user: { ...data.user, avatarUrl: body.data.url } })
      toast.success('Profile photo added')
    } catch {
      toast.error('Could not upload your photo. Please try again.')
    } finally {
      setSaving(false)
      if (avatarInput.current) avatarInput.current.value = ''
    }
  }

  async function uploadCover(file: File | undefined) {
    if (!file || !data?.professional) return
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a JPEG, PNG or WebP image')
      return
    }
    if (file.size > MAX_SOURCE_IMAGE_SIZE) {
      toast.error('Choose a cover image smaller than 15MB')
      return
    }
    setSaving(true)
    try {
      const uploadFile = await optimizeLargeImage(file, 8 * 1024 * 1024, 1920)
      const form = new FormData()
      form.append('cover', uploadFile)
      const response = await fetch('/api/upload/cover-image', { method: 'POST', body: form })
      const body = await response.json()
      if (!response.ok || !body.success) {
        toast.error(body.error || 'Could not upload your cover image')
        return
      }
      advance({ ...data, professional: { ...data.professional, coverImageUrl: body.data.url } })
      toast.success('Your profile is ready')
    } catch {
      toast.error('Could not upload your cover image. Please try again.')
    } finally {
      setSaving(false)
      if (coverInput.current) coverInput.current.value = ''
    }
  }

  if (loading || !data) return <SetupLoading />

  const exitHref = data.role === 'artisan' ? '/dashboard' : '/professionals'
  const publicProfileHref = data.role === 'artisan' ? `/artisans/${data.user.id}` : `/professionals/${data.user.id}`

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandWordmark priority className="w-[185px] sm:w-[220px]" />
          {!finished && <Link href={exitHref} className="text-sm font-semibold text-slate-500 hover:text-brand-600">Finish later</Link>}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50/70 px-4 py-6 sm:px-6 lg:border-b-0 lg:border-r lg:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Profile setup</p>
          <h1 className="mt-2 font-display text-xl font-bold text-slate-950">
            {data.role === 'artisan' ? 'Get ready for booking requests' : 'Build a profile recruiters can trust'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {data.role === 'artisan'
              ? 'Show clients what you do, where you work and why they should choose you.'
              : 'Present your experience clearly so the right opportunities can find you.'}
          </p>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-bold text-brand-700">{progress}%</span>
          </div>

          <ol className="mt-6 hidden space-y-1 lg:block">
            {steps.map((item, index) => {
              const complete = states[index]
              const active = !finished && index === step
              return (
                <li key={item.title}>
                  <button
                    type="button"
                    disabled={!complete && !active}
                    onClick={() => complete && setStep(index)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors ${active ? 'bg-white font-semibold text-brand-700' : complete ? 'text-slate-700 hover:bg-white' : 'text-slate-400'}`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${complete ? 'border-brand-500 bg-brand-500 text-white' : active ? 'border-brand-500 text-brand-700' : 'border-slate-300'}`}>
                      {complete ? '✓' : index + 1}
                    </span>
                    {item.shortTitle}
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <div className="px-4 py-8 sm:px-8 sm:py-12 lg:px-14">
          {finished ? (
            <CompletionView data={data} publicProfileHref={publicProfileHref} exitHref={exitHref} />
          ) : (
            <section key={`${data.role}-${step}`} className="animate-setup-step mx-auto max-w-2xl">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.max(0, current - 1))}
                  className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-brand-700 lg:hidden"
                >
                  <span aria-hidden="true">←</span> Back
                </button>
              )}
              <p className="text-sm font-semibold text-brand-600">Step {step + 1} of {steps.length}</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{steps[step].title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">{steps[step].description}</p>

              <div className="mt-8">
                {step === 0 && (
                  <PhotoStep data={data} inputRef={avatarInput} saving={saving} onFile={uploadAvatar} />
                )}
                {data.role === 'artisan' && step === 1 && data.artisan && (
                  <ArtisanBusinessStep
                    value={data.artisan}
                    saving={saving}
                    onContinue={async (value) => {
                      if (!await patchSetup({ action: 'artisan-business', ...value })) return
                      advance({ ...data, artisan: value })
                    }}
                  />
                )}
                {data.role === 'artisan' && step === 2 && data.artisan && (
                  <LocationStep
                    role="artisan"
                    user={data.user}
                    initialState={(data.artisan.state || data.user.state) as NigerianState}
                    initialLga={data.artisan.lga || data.user.lga}
                    initialAddress={data.artisan.location || data.user.address}
                    saving={saving}
                    onContinue={async (location) => {
                      const user = {
                        ...data.user,
                        state: location.state,
                        lga: location.lga,
                        address: location.address,
                        bio: data.user.bio || data.artisan!.description,
                      }
                      if (!await patchSetup({ action: 'personal', ...user, avatarUrl: undefined, email: undefined, id: undefined, role: undefined })) return
                      advance({ ...data, user, artisan: { ...data.artisan!, state: location.state, lga: location.lga, location: location.address, businessContact: user.phone } })
                    }}
                  />
                )}
                {data.role === 'artisan' && step === 3 && data.artisan && (
                  <AboutStep
                    role="artisan"
                    initialBio={data.artisan.description || data.user.bio}
                    saving={saving}
                    onContinue={async (bio) => {
                      const user = { ...data.user, bio }
                      if (!await patchSetup({ action: 'personal', ...user, avatarUrl: undefined, email: undefined, id: undefined, role: undefined })) return
                      advance({ ...data, user, artisan: { ...data.artisan!, description: bio } })
                    }}
                  />
                )}

                {data.role === 'professional' && step === 1 && data.professional && (
                  <ProfessionalIntroStep
                    user={data.user}
                    saving={saving}
                    onContinue={async (user) => {
                      if (!await patchSetup({ action: 'personal', ...user, avatarUrl: undefined, email: undefined, id: undefined, role: undefined })) return
                      advance({ ...data, user })
                    }}
                  />
                )}
                {data.role === 'professional' && step === 2 && data.professional && (
                  <ProfessionalCoreStep
                    value={data.professional}
                    saving={saving}
                    onContinue={async (professional) => {
                      if (!await patchSetup({
                        action: 'professional-core',
                        industryCategory: professional.industryCategory,
                        professionalServiceCategory: professional.professionalServiceCategory,
                        jobTitle: professional.jobTitle,
                        qualification: professional.qualification,
                        yearsExperience: professional.yearsExperience,
                        linkedinOrPortfolioUrl: professional.linkedinOrPortfolioUrl,
                      })) return
                      advance({ ...data, professional })
                    }}
                  />
                )}
                {data.role === 'professional' && step === 3 && data.professional && (
                  <ProfessionalBackgroundStep
                    value={data.professional}
                    saving={saving}
                    onContinue={async (background) => {
                      if (!await patchSetup({ action: 'professional-background', ...background })) return
                      advance({ ...data, professional: { ...data.professional!, ...background } })
                    }}
                  />
                )}
                {data.role === 'professional' && step === 4 && data.professional && (
                  <CoverStep data={data} inputRef={coverInput} saving={saving} onFile={uploadCover} />
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

function stepDefinitions(role: SetupRole) {
  return role === 'artisan'
    ? [
        { shortTitle: 'Profile photo', title: 'Add a clear profile photo', description: 'A recognisable photo helps clients feel confident that they know who they are contacting.' },
        { shortTitle: 'Business basics', title: 'Tell clients what you do', description: 'Use a clear business or trading name and choose the service that best represents your work.' },
        { shortTitle: 'Service area', title: 'Where can clients find you?', description: 'Add your service area and a practical address clients can use when discussing a job.' },
        { shortTitle: 'About your work', title: 'Give clients a reason to choose you', description: 'Describe your services, experience and the kind of jobs you handle best.' },
      ]
    : [
        { shortTitle: 'Profile photo', title: 'Add a professional profile photo', description: 'A clear, recent photo makes your profile more credible and easier for recruiters to remember.' },
        { shortTitle: 'Introduction', title: 'Complete your professional introduction', description: 'Help recruiters understand where you are based and what you bring to an opportunity.' },
        { shortTitle: 'Career headline', title: 'Sharpen your professional headline', description: 'Review the role, specialty and experience recruiters will see first.' },
        { shortTitle: 'Background', title: 'Add qualifications and work experience', description: 'A concise work history gives recruiters the evidence they need to assess your profile.' },
        { shortTitle: 'Cover image', title: 'Finish with a professional cover image', description: 'Choose a simple image connected to your work, industry or professional identity.' },
      ]
}

function completionStates(data: SetupData): boolean[] {
  if (data.role === 'artisan') {
    const artisan = data.artisan
    return [
      Boolean(data.user.avatarUrl),
      Boolean(artisan?.businessName.trim() && artisan.category.trim() && artisan.businessContact.trim() && artisan.yearsOfExperience !== null),
      Boolean(artisan?.state.trim() && artisan.lga.trim() && artisan.location.trim()),
      Boolean(artisan && artisan.description.trim().length >= 40),
    ]
  }
  const professional = data.professional
  return [
    Boolean(data.user.avatarUrl),
    Boolean(data.user.lga.trim() && data.user.address.trim() && data.user.bio.trim().length >= 40),
    Boolean(professional?.industryCategory.trim() && professional.professionalServiceCategory.trim() && professional.jobTitle.trim() && professional.qualification.trim() && professional.yearsExperience !== undefined),
    Boolean(professional?.schoolName.trim() && professional.workExperience.length > 0),
    Boolean(professional?.coverImageUrl.trim()),
  ]
}

function PhotoStep({ data, inputRef, saving, onFile }: { data: SetupData; inputRef: React.RefObject<HTMLInputElement | null>; saving: boolean; onFile: (file?: File) => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
      <Avatar src={data.user.avatarUrl} initials={initials(data.user)} size="xl" className="h-28 w-28 text-3xl ring-4 ring-white" />
      <h3 className="mt-5 font-semibold text-slate-900">Use a photo that clearly shows your face</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Square photos work best. JPEG, PNG or WebP, up to 15MB. Large photos are optimised automatically.</p>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={saving} className="btn-primary mt-6 px-6">
        {saving ? 'Uploading photo…' : data.user.avatarUrl ? 'Replace and continue' : 'Choose profile photo'}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
    </div>
  )
}

function ArtisanBusinessStep({ value, saving, onContinue }: { value: ArtisanSetup; saving: boolean; onContinue: (value: ArtisanSetup) => void }) {
  const [form, setForm] = useState(value)
  return (
    <WizardForm onSubmit={() => onContinue(form)} saving={saving}>
      <Field label="Business or trading name"><input className="input-field" value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} required /></Field>
      <Field label="Primary service"><select className="input-field appearance-none" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required><option value="">Select your service</option>{BUSINESS_CATEGORY_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{group.categories.map((category) => <option key={category} value={category}>{category}</option>)}</optgroup>)}</select></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business phone"><input className="input-field" type="tel" value={form.businessContact} onChange={(event) => setForm({ ...form, businessContact: event.target.value })} required /></Field>
        <Field label="Years of experience"><input className="input-field" type="number" inputMode="numeric" min={0} max={80} value={form.yearsOfExperience ?? ''} onChange={(event) => setForm({ ...form, yearsOfExperience: event.target.value === '' ? null : Number(event.target.value) })} required /></Field>
      </div>
    </WizardForm>
  )
}

function LocationStep({ role, initialState, initialLga, initialAddress, saving, onContinue }: { role: SetupRole; user: SetupUser; initialState: NigerianState; initialLga: string; initialAddress: string; saving: boolean; onContinue: (value: { state: NigerianState; lga: string; address: string }) => void }) {
  const validState = NIGERIAN_STATE_NAMES.includes(initialState) ? initialState : 'Lagos'
  const [state, setState] = useState<NigerianState>(validState)
  const [lga, setLga] = useState(initialLga)
  const [address, setAddress] = useState(initialAddress)
  const lgas = getLocalGovernments(state)
  return (
    <WizardForm onSubmit={() => onContinue({ state, lga, address })} saving={saving}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="State"><select className="input-field appearance-none" value={state} onChange={(event) => { setState(event.target.value as NigerianState); setLga('') }}>{NIGERIAN_STATE_NAMES.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
        <Field label="Local government"><select className="input-field appearance-none" value={lga} onChange={(event) => setLga(event.target.value)} required><option value="">Select local government</option>{lgas.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
      </div>
      <Field label={role === 'artisan' ? 'Business or service address' : 'Street address'} hint={role === 'artisan' ? 'Use the address you normally work from. Your live location remains separate.' : undefined}><input className="input-field" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="House number, street and area" required minLength={5} /></Field>
    </WizardForm>
  )
}

function AboutStep({ role, initialBio, saving, onContinue }: { role: SetupRole; initialBio: string; saving: boolean; onContinue: (bio: string) => void }) {
  const [bio, setBio] = useState(initialBio)
  return (
    <WizardForm onSubmit={() => onContinue(bio.trim())} saving={saving}>
      <Field label={role === 'artisan' ? 'Service description' : 'Professional summary'} hint="Aim for at least two clear sentences.">
        <textarea className="input-field min-h-40 resize-y" value={bio} onChange={(event) => setBio(event.target.value)} minLength={40} maxLength={1000} required placeholder={role === 'artisan' ? 'Explain the services you provide, the jobs you handle and what clients can expect from you.' : 'Summarise your strengths, experience and the opportunities you are interested in.'} />
      </Field>
      <p className="-mt-3 text-right text-xs text-slate-400">{bio.length}/1000</p>
    </WizardForm>
  )
}

function ProfessionalIntroStep({ user, saving, onContinue }: { user: SetupUser; saving: boolean; onContinue: (user: SetupUser) => void }) {
  const validState = NIGERIAN_STATE_NAMES.includes(user.state as NigerianState) ? user.state as NigerianState : 'Lagos'
  const [form, setForm] = useState({ ...user, state: validState })
  const lgas = getLocalGovernments(form.state as NigerianState)
  return (
    <WizardForm onSubmit={() => onContinue(form)} saving={saving}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name"><input className="input-field" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></Field>
        <Field label="Last name"><input className="input-field" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></Field>
      </div>
      <Field label="Phone number"><input className="input-field" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="State"><select className="input-field appearance-none" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value as NigerianState, lga: '' })}>{NIGERIAN_STATE_NAMES.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
        <Field label="Local government"><select className="input-field appearance-none" value={form.lga} onChange={(event) => setForm({ ...form, lga: event.target.value })} required><option value="">Select local government</option>{lgas.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
      </div>
      <Field label="Street address"><input className="input-field" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} required minLength={5} /></Field>
      <Field label="Professional summary" hint="Two or three sentences about your strengths and the work you want to do."><textarea className="input-field min-h-36 resize-y" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} minLength={40} maxLength={1000} required /></Field>
    </WizardForm>
  )
}

function ProfessionalCoreStep({ value, saving, onContinue }: { value: ProfessionalSetup; saving: boolean; onContinue: (value: ProfessionalSetup) => void }) {
  const [form, setForm] = useState(value)
  return (
    <WizardForm onSubmit={() => onContinue(form)} saving={saving}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Industry"><select className="input-field appearance-none" value={form.industryCategory} onChange={(event) => setForm({ ...form, industryCategory: event.target.value })}>{INDUSTRY_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
        <Field label="Professional specialty"><select className="input-field appearance-none" value={form.professionalServiceCategory} onChange={(event) => setForm({ ...form, professionalServiceCategory: event.target.value })}>{PROFESSIONAL_SERVICE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
      </div>
      <Field label="Current or preferred job title"><input className="input-field" value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Professional qualification"><select className="input-field appearance-none" value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })}>{PROFESSIONAL_QUALIFICATIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
        <Field label="Years of experience"><input className="input-field" type="number" min={0} max={70} value={form.yearsExperience} onChange={(event) => setForm({ ...form, yearsExperience: Number(event.target.value) })} required /></Field>
      </div>
      <Field label="LinkedIn or portfolio URL" hint="Optional"><input className="input-field" type="url" value={form.linkedinOrPortfolioUrl} onChange={(event) => setForm({ ...form, linkedinOrPortfolioUrl: event.target.value })} placeholder="https://" /></Field>
    </WizardForm>
  )
}

function ProfessionalBackgroundStep({ value, saving, onContinue }: { value: ProfessionalSetup; saving: boolean; onContinue: (value: Pick<ProfessionalSetup, 'schoolName' | 'certifications' | 'workExperience'>) => void }) {
  const firstExperience = value.workExperience[0] || blankExperience()
  const firstCertification = value.certifications[0]
  const [schoolName, setSchoolName] = useState(value.schoolName)
  const [experience, setExperience] = useState(firstExperience)
  const [certificationName, setCertificationName] = useState(firstCertification?.name || '')
  const [certificationYear, setCertificationYear] = useState(firstCertification?.yearObtained || CURRENT_YEAR)
  return (
    <WizardForm
      onSubmit={() => onContinue({
        schoolName,
        workExperience: [experience, ...value.workExperience.slice(1)],
        certifications: certificationName.trim()
          ? [{ name: certificationName.trim(), yearObtained: certificationYear }, ...value.certifications.slice(1)]
          : value.certifications.slice(1),
      })}
      saving={saving}
    >
      <Field label="School or training institution"><input className="input-field" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} required /></Field>
      <div className="border-t border-slate-200 pt-6">
        <h3 className="font-semibold text-slate-900">Most relevant work experience</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Role"><input className="input-field" value={experience.jobTitle} onChange={(event) => setExperience({ ...experience, jobTitle: event.target.value })} required /></Field>
          <Field label="Employer or organisation"><input className="input-field" value={experience.employer} onChange={(event) => setExperience({ ...experience, employer: event.target.value })} required /></Field>
          <Field label="Start year"><input className="input-field" type="number" min={1950} max={CURRENT_YEAR} value={experience.startYear} onChange={(event) => setExperience({ ...experience, startYear: Number(event.target.value) })} required /></Field>
          {!experience.current && <Field label="End year"><input className="input-field" type="number" min={experience.startYear} max={CURRENT_YEAR} value={experience.endYear || ''} onChange={(event) => setExperience({ ...experience, endYear: Number(event.target.value) })} required /></Field>}
        </div>
        <label className="mb-5 flex min-h-11 items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={experience.current} onChange={(event) => setExperience({ ...experience, current: event.target.checked, endYear: event.target.checked ? undefined : experience.endYear })} className="h-4 w-4 accent-brand-500" />I currently work here</label>
        <Field label="What did you do?" hint="Optional"><textarea className="input-field min-h-28 resize-y" value={experience.description || ''} onChange={(event) => setExperience({ ...experience, description: event.target.value })} /></Field>
      </div>
      <div className="border-t border-slate-200 pt-6">
        <h3 className="font-semibold text-slate-900">Certification <span className="font-normal text-slate-400">(optional)</span></h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
          <Field label="Certification name"><input className="input-field" value={certificationName} onChange={(event) => setCertificationName(event.target.value)} /></Field>
          <Field label="Year obtained"><input className="input-field" type="number" min={1950} max={CURRENT_YEAR} value={certificationYear} onChange={(event) => setCertificationYear(Number(event.target.value))} /></Field>
        </div>
      </div>
    </WizardForm>
  )
}

function CoverStep({ data, inputRef, saving, onFile }: { data: SetupData; inputRef: React.RefObject<HTMLInputElement | null>; saving: boolean; onFile: (file?: File) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="relative flex aspect-[4/1] min-h-40 items-center justify-center overflow-hidden bg-[linear-gradient(120deg,#0F4F4A,#1F6F68,#72c7c3)] px-6 text-center text-sm font-semibold text-white">
        {data.professional?.coverImageUrl && (
          <Image src={data.professional.coverImageUrl} alt="Current professional cover" fill unoptimized className="object-cover" />
        )}
        <div className="absolute inset-0 bg-black/20" />
        <span className="relative z-10">{data.professional?.coverImageUrl ? 'Choose a new image to replace your current cover' : 'A simple workplace, project or industry image works well'}</span>
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-sm leading-6 text-slate-600">Use a wide JPEG, PNG or WebP image up to 15MB. Large images are optimised automatically.</p>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={saving} className="btn-primary mt-5 px-6">{saving ? 'Uploading cover…' : 'Choose cover and finish'}</button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
      </div>
    </div>
  )
}

function CompletionView({ data, publicProfileHref, exitHref }: { data: SetupData; publicProfileHref: string; exitHref: string }) {
  return (
    <section className="animate-setup-step mx-auto max-w-2xl py-4 sm:py-10">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl text-brand-700">✓</span>
      <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-brand-600">Profile setup complete</p>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        {data.role === 'artisan' ? 'You’re ready to be discovered by clients' : 'Your profile is ready to stand out'}
      </h2>
      <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
        {data.role === 'artisan'
          ? 'Clients can now understand your services, location and experience before sending a booking request.'
          : 'Recruiters can now review a clear professional story, from your qualifications and experience to your specialty.'}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href={publicProfileHref} className="btn-primary px-6">View my public profile</Link>
        <Link href={exitHref} className="btn-ghost px-6">{data.role === 'artisan' ? 'Go to dashboard' : 'Explore opportunities'}</Link>
      </div>
    </section>
  )
}

function WizardForm({ onSubmit, saving, children }: { onSubmit: () => void; saving: boolean; children: React.ReactNode }) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
      {children}
      <div className="mt-8 flex justify-end border-t border-slate-200 pt-5">
        <button type="submit" disabled={saving} className="btn-primary min-w-40 px-6">{saving ? 'Saving…' : 'Save and continue'}</button>
      </div>
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="mb-5"><label className="label">{label}{hint && <span className="ml-1 font-normal text-slate-400">({hint})</span>}</label>{children}</div>
}

function SetupLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-white px-4">
      <div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /><p className="mt-4 text-sm text-slate-500">Preparing your profile setup…</p></div>
    </div>
  )
}
