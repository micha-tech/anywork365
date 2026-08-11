'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import {
  NIGERIAN_STATE_NAMES,
  type NigerianState,
  type PortfolioItem,
  type ProfessionalCertification,
  type ProfessionalWorkExperience,
} from '@/types'
import { useCurrentUser, getInitialsFromUser, notifyCurrentUserChanged } from '@/hooks/useCurrentUser'
import { getLocalGovernments } from '@/lib/nigeria-locations'
import { DualClientRecruiterAccount } from '@/components/profile/DualClientRecruiterAccount'

const MAX_AVATAR_DIMENSION = 512
const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024
const AVATAR_IMAGE_TYPE = 'image/webp'
const AVATAR_IMAGE_QUALITY = 0.82
const PORTFOLIO_IMAGE_DIMENSION = 1600
const PORTFOLIO_IMAGE_QUALITY = 0.86
const COVER_IMAGE_DIMENSION = 1920
const COVER_IMAGE_QUALITY = 0.86
const MAX_COVER_UPLOAD_BYTES = 8 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const IMAGE_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
const EXTENSION_BY_IMAGE_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

interface ProfileForm {
  firstName: string
  lastName: string
  phone: string
  state: NigerianState
  lga: string
  address: string
  bio: string
}

type EditableCertification = ProfessionalCertification & { key: string }
type EditableWorkExperience = ProfessionalWorkExperience & { key: string }

const CURRENT_YEAR = new Date().getFullYear()

function itemKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

function blankCertification(): EditableCertification {
  return { key: itemKey(), name: '', yearObtained: CURRENT_YEAR }
}

function blankWorkExperience(): EditableWorkExperience {
  return {
    key: itemKey(),
    jobTitle: '',
    employer: '',
    startYear: CURRENT_YEAR,
    current: true,
    description: '',
  }
}

function inferImageType(file: File): string {
  if (SUPPORTED_IMAGE_TYPES.includes(file.type)) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  return IMAGE_TYPE_BY_EXTENSION[extension] || file.type
}

function withInferredImageType(file: File): File {
  const inferredType = inferImageType(file)
  if (!inferredType || inferredType === file.type) return file
  return new File([file], file.name, { type: inferredType, lastModified: file.lastModified })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
}

async function optimizeImageFile(file: File, maxDimension: number, quality: number): Promise<File> {
  const sourceFile = withInferredImageType(file)
  if (!sourceFile.type.startsWith('image/')) return sourceFile

  const objectUrl = URL.createObjectURL(sourceFile)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read image'))
      img.src = objectUrl
    })

    const maxSourceDimension = Math.max(image.naturalWidth, image.naturalHeight)
    const scale = Math.min(1, maxDimension / maxSourceDimension)
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return file

    context.drawImage(image, 0, 0, width, height)

    const fallbackType = sourceFile.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const candidateTypes = Array.from(new Set([AVATAR_IMAGE_TYPE, fallbackType]))

    for (const candidateType of candidateTypes) {
      const blob = await canvasToBlob(canvas, candidateType, quality)
      if (!blob || blob.size === 0) continue

      const optimizedType = blob.type || candidateType
      const extension = EXTENSION_BY_IMAGE_TYPE[optimizedType] || 'jpg'
      const baseName = sourceFile.name.replace(/\.[^/.]+$/, '') || 'avatar'
      const optimizedFile = new File([blob], `${baseName}.${extension}`, {
        type: optimizedType,
        lastModified: Date.now(),
      })

      if (optimizedFile.size < sourceFile.size || maxSourceDimension > maxDimension) {
        return optimizedFile
      }
    }

    return sourceFile
  } catch {
    return sourceFile
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export default function ProfilePage() {
  const { user, loading }   = useCurrentUser()
  const fileInputRef        = useRef<HTMLInputElement>(null)
  const portfolioInputRef   = useRef<HTMLInputElement>(null)
  const coverInputRef       = useRef<HTMLInputElement>(null)

  // Photo state
  const [photoUrl,      setPhotoUrl]      = useState<string | null>(null)
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null)
  const [uploading,     setUploading]     = useState(false)
  const [dragOver,      setDragOver]      = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverRemoving, setCoverRemoving] = useState(false)

  // Form state
  const [saving, setSaving] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstName: '',
    lastName: '',
    phone: '',
    state: 'Lagos',
    lga: '',
    address: '',
    bio: '',
  })
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [portfolioUploading, setPortfolioUploading] = useState(false)
  const [portfolioTitle, setPortfolioTitle] = useState('')
  const [portfolioDescription, setPortfolioDescription] = useState('')
  const [portfolioLink, setPortfolioLink] = useState('')
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)
  const [portfolioPreview, setPortfolioPreview] = useState<string | null>(null)
  const [backgroundLoading, setBackgroundLoading] = useState(false)
  const [backgroundSaving, setBackgroundSaving] = useState(false)
  const [schoolName, setSchoolName] = useState('')
  const [certifications, setCertifications] = useState<EditableCertification[]>([])
  const [workExperience, setWorkExperience] = useState<EditableWorkExperience[]>([])

  useEffect(() => {
    if (!user) return

    const state = NIGERIAN_STATE_NAMES.includes(user.city as NigerianState)
      ? user.city as NigerianState
      : 'Lagos'
    const localGovernments = getLocalGovernments(state)

    setProfileForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      state,
      lga: user.lga && localGovernments.includes(user.lga) ? user.lga : '',
      address: user.address || '',
      bio: user.bio || '',
    })
  }, [user])

  useEffect(() => {
    if (user?.role !== 'artisan' && user?.role !== 'professional') return
    setPortfolioLoading(true)
    fetch('/api/profile/portfolio')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setPortfolio(data.data || [])
      })
      .catch(() => toast.error('Could not load portfolio'))
      .finally(() => setPortfolioLoading(false))
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'professional') return
    fetch('/api/upload/cover-image')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setCoverUrl(data.data?.url || null)
      })
      .catch(() => undefined)
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'professional') return
    setBackgroundLoading(true)
    fetch('/api/profile/professional')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Could not load professional background')
        }
        setSchoolName(data.data?.schoolName || '')
        setCertifications((data.data?.certifications || []).map((item: ProfessionalCertification) => ({
          ...item,
          key: itemKey(),
        })))
        setWorkExperience((data.data?.workExperience || []).map((item: ProfessionalWorkExperience) => ({
          ...item,
          key: itemKey(),
        })))
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setBackgroundLoading(false))
  }, [user?.role])

  useEffect(() => {
    return () => {
      if (portfolioPreview) URL.revokeObjectURL(portfolioPreview)
    }
  }, [portfolioPreview])

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  const localGovernments = getLocalGovernments(profileForm.state)

  const initials    = getInitialsFromUser(user)
  const fullName    = user ? `${user.firstName} ${user.lastName}` : ''
  const roleLabel   = user?.role === 'artisan' ? 'Artisan' : user?.role === 'professional' ? 'Professional' : user?.role === 'recruiter' ? 'Recruiter' : 'Client'
  // Show uploaded photo, else existing avatarUrl from session, else null (shows initials)
  const displayPhoto = photoUrl ?? user?.avatarUrl ?? null

  // ─── Handle file selection (from input or drag-drop) ─────────────────────

  const handleFile = useCallback(async (file: File) => {
    const sourceFile = withInferredImageType(file)
    if (!SUPPORTED_IMAGE_TYPES.includes(sourceFile.type)) {
      toast.error('Only JPEG, PNG, or WebP images are allowed.')
      return
    }
    if (sourceFile.size > MAX_SOURCE_IMAGE_BYTES) {
      toast.error('Image must be smaller than 15MB.')
      return
    }

    // Show local preview immediately for snappy UX
    const objectUrl = URL.createObjectURL(sourceFile)
    setPhotoPreview(objectUrl)
    setUploading(true)

    try {
      const uploadFile = await optimizeImageFile(sourceFile, MAX_AVATAR_DIMENSION, AVATAR_IMAGE_QUALITY)
      if (uploadFile.size > MAX_UPLOAD_IMAGE_BYTES) {
        toast.error('Image is still too large after optimization. Try a smaller photo.')
        setPhotoPreview(null)
        return
      }

      const form = new FormData()
      form.append('avatar', uploadFile)

      const res  = await fetch('/api/upload/avatar', { method: 'POST', body: form })
      const data = await res.json()

      if (data.success) {
        const cacheSeparator = data.data.url.includes('?') ? '&' : '?'
        setPhotoUrl(`${data.data.url}${cacheSeparator}v=${Date.now()}`)
        setPhotoPreview(null)
        notifyCurrentUserChanged()
      } else {
        toast.error(data.error || 'Couldn\u2019t upload photo')
        setPhotoPreview(null)
      }
    } catch {
      toast.error('Network error')
      setPhotoPreview(null)
    } finally {
      URL.revokeObjectURL(objectUrl)
      setUploading(false)
    }
  }, [])

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // ─── Save profile ─────────────────────────────────────────────────────────

  function updateProfileField<K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) {
    setProfileForm((current) => ({ ...current, [field]: value }))
  }

  function handleStateChange(state: NigerianState) {
    setProfileForm((current) => ({ ...current, state, lga: '' }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Could not save profile')
        return
      }

      notifyCurrentUserChanged()
      toast.success('Profile saved')
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation.trim() !== 'DELETE') return

    setDeletingAccount(true)
    try {
      const response = await fetch('/api/auth/me', { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok || !data.success) {
        if (response.status === 401) {
          toast.error('Your session has expired. Please sign in again before deleting your account.')
        } else {
          toast.error(data.error || 'We couldn’t delete your account. Please try again or contact support.')
        }
        return
      }

      setDeleteDialogOpen(false)
      setDeleteConfirmation('')
      toast.success('Account deleted')
      window.location.href = '/'
    } catch {
      toast.error('We couldn’t connect to the server. Check your connection and try again.')
    } finally {
      setDeletingAccount(false)
    }
  }

  function handlePortfolioFile(file: File | null) {
    if (portfolioPreview) URL.revokeObjectURL(portfolioPreview)
    setPortfolioFile(file)
    setPortfolioPreview(file ? URL.createObjectURL(file) : null)
  }

  async function handlePortfolioUpload() {
    if (!portfolioTitle.trim() || portfolioDescription.trim().length < 20) {
      toast.error('Add a title and a description of at least 20 characters')
      return
    }
    if (user?.role === 'artisan' && !portfolioFile) {
      toast.error('Add a work image for this portfolio item')
      return
    }

    setPortfolioUploading(true)
    try {
      const form = new FormData()
      if (portfolioFile) {
        const uploadFile = await optimizeImageFile(
          portfolioFile,
          PORTFOLIO_IMAGE_DIMENSION,
          PORTFOLIO_IMAGE_QUALITY
        )
        if (uploadFile.size > MAX_UPLOAD_IMAGE_BYTES) {
          toast.error('Portfolio image is too large. Choose a smaller image.')
          return
        }
        form.append('image', uploadFile)
      }
      form.append('title', portfolioTitle.trim())
      form.append('description', portfolioDescription.trim())
      form.append('projectUrl', portfolioLink.trim())
      const response = await fetch('/api/profile/portfolio', { method: 'POST', body: form })
      const data = await response.json()

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Could not add portfolio item')
        return
      }

      setPortfolio((items) => [data.data, ...items])
      setPortfolioTitle('')
      setPortfolioDescription('')
      setPortfolioLink('')
      handlePortfolioFile(null)
      if (portfolioInputRef.current) portfolioInputRef.current.value = ''
      toast.success('Portfolio item added')
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setPortfolioUploading(false)
    }
  }

  async function handlePortfolioDelete(id: string) {
    const response = await fetch(`/api/profile/portfolio/${id}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok || !data.success) {
      toast.error(data.error || 'Could not remove portfolio item')
      return
    }
    setPortfolio((items) => items.filter((item) => item.id !== id))
    toast.success('Portfolio item removed')
  }

  function updateCertification(key: string, updates: Partial<EditableCertification>) {
    setCertifications((items) => items.map((item) => item.key === key ? { ...item, ...updates } : item))
  }

  function updateWorkExperience(key: string, updates: Partial<EditableWorkExperience>) {
    setWorkExperience((items) => items.map((item) => item.key === key ? { ...item, ...updates } : item))
  }

  async function handleProfessionalBackgroundSave() {
    setBackgroundSaving(true)
    try {
      const response = await fetch('/api/profile/professional', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          certifications: certifications.map(({ key: _key, ...item }) => item),
          workExperience: workExperience.map(({ key: _key, ...item }) => ({
            ...item,
            endYear: item.current ? undefined : item.endYear,
            description: item.description?.trim() || undefined,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error(data.error || 'Could not save professional background')
        return
      }
      toast.success('Professional background saved')
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setBackgroundSaving(false)
    }
  }

  async function handleCoverUpload(file: File | null) {
    if (!file) return
    const sourceFile = withInferredImageType(file)
    if (!SUPPORTED_IMAGE_TYPES.includes(sourceFile.type)) {
      toast.error('Use a JPEG, PNG, or WebP cover image.')
      return
    }
    if (sourceFile.size > MAX_SOURCE_IMAGE_BYTES) {
      toast.error('Cover image must be smaller than 15MB before optimization.')
      return
    }

    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverPreview(URL.createObjectURL(sourceFile))
    setCoverUploading(true)
    try {
      const uploadFile = await optimizeImageFile(sourceFile, COVER_IMAGE_DIMENSION, COVER_IMAGE_QUALITY)
      if (uploadFile.size > MAX_COVER_UPLOAD_BYTES) {
        toast.error('Cover image is still too large. Choose a smaller image.')
        return
      }
      const form = new FormData()
      form.append('cover', uploadFile)
      const response = await fetch('/api/upload/cover-image', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error(data.error || 'Could not update your cover image')
        return
      }
      setCoverUrl(data.data.url)
      setCoverPreview(null)
      if (coverInputRef.current) coverInputRef.current.value = ''
      toast.success('Cover image updated')
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setCoverUploading(false)
    }
  }

  async function handleCoverRemove() {
    setCoverRemoving(true)
    try {
      const response = await fetch('/api/upload/cover-image', { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error(data.error || 'Could not remove your cover image')
        return
      }
      setCoverUrl(null)
      setCoverPreview(null)
      toast.success('Cover image removed')
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setCoverRemoving(false)
    }
  }

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-500">Loading profile...</p>
      </div>
    )
  }

  const currentPhoto = photoPreview ?? displayPhoto
  const currentCover = coverPreview ?? coverUrl

  return (
    <>
      <div className="mb-5 sm:mb-7">
        <h1 className="font-display text-xl sm:text-2xl font-semibold">My Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your personal information</p>
      </div>

      {user && <DualClientRecruiterAccount user={user} />}

      {user?.role === 'professional' && (
        <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-32 overflow-hidden bg-[linear-gradient(120deg,#064e3b_0%,#0f766e_50%,#2dd4bf_100%)] sm:h-52">
            {currentCover && (
              <Image
                src={currentCover}
                alt="Profile cover preview"
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
                unoptimized
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            <div className="absolute bottom-3 right-3 z-10 flex flex-wrap justify-end gap-2">
              {currentCover && (
                <button
                  type="button"
                  onClick={handleCoverRemove}
                  disabled={coverRemoving || coverUploading}
                  className="rounded-lg bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/70 disabled:opacity-50"
                >
                  {coverRemoving ? 'Removing...' : 'Remove'}
                </button>
              )}
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading || coverRemoving}
                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {coverUploading ? 'Uploading...' : currentCover ? 'Change cover' : 'Add cover image'}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Profile cover image</h2>
              <p className="text-xs text-slate-500">A wide 4:1 image works best. JPEG, PNG, or WebP.</p>
            </div>
            <span className="text-xs text-slate-400">Recommended: 1584 × 396 px</span>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={(event) => handleCoverUpload(event.target.files?.[0] || null)}
            aria-label="Upload profile cover image"
          />
        </section>
      )}

      {/* ── Profile header ───────────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

          {/* Avatar with overlay edit button */}
          <div className="relative flex-shrink-0 group">
            <Avatar
              src={currentPhoto}
              initials={initials}
              size="xl"
              colorIndex={0}
              className="ring-2 ring-slate-200"
            />

            {/* Edit overlay — appears on hover */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Change photo"
            >
              {uploading ? (
                <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </button>

          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-semibold">{fullName}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{roleLabel} · {user?.city ?? ''}</p>
            {uploading && (
              <p className="text-xs text-brand-600 mt-1.5">Uploading photo...</p>
            )}
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-outline w-full sm:w-auto text-sm disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : currentPhoto ? 'Change Photo' : 'Add Photo'}
          </button>
        </div>

        {/* Drag-and-drop zone — shown when no photo */}
        {!currentPhoto && !uploading && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-4 border-2 border-dashed rounded-xl px-6 py-5 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-brand-500 bg-surface-50'
                : 'border-slate-200 hover:border-brand-500 hover:bg-surface-50'
            }`}
          >
            <svg className="w-7 h-7 text-slate-500 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-sm text-slate-500">
              <span className="font-medium text-brand-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate-500 mt-1">JPEG, PNG or WebP · Max 15MB</p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={onFileInputChange}
          aria-label="Upload profile photo"
        />
      </div>

      {/* ── Profile form ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Personal info */}
        <div className="card">
          <h3 className="font-medium text-base mb-5">Personal Information</h3>
          <div className="form-group">
            <label className="label">Full Name</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="input-field"
                value={profileForm.firstName}
                onChange={(event) => updateProfileField('firstName', event.target.value)}
                placeholder="First name"
                autoComplete="given-name"
              />
              <input
                className="input-field"
                value={profileForm.lastName}
                onChange={(event) => updateProfileField('lastName', event.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Email address</label>
            <input
              className="input-field"
              type="email"
              inputMode="email"
              value={user?.email ?? ''}
              placeholder="you@example.com"
              readOnly
            />
          </div>
          <div className="form-group">
            <label className="label">Phone number</label>
            <input
              className="input-field"
              type="tel"
              inputMode="tel"
              value={profileForm.phone}
              onChange={(event) => updateProfileField('phone', event.target.value)}
              placeholder="+234 800 000 0000"
              autoComplete="tel"
            />
          </div>
          <div className="form-group">
            <label className="label">State</label>
            <select
              className="input-field appearance-none"
              value={profileForm.state}
              onChange={(event) => handleStateChange(event.target.value as NigerianState)}
            >
              {NIGERIAN_STATE_NAMES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Local Government</label>
            <select
              className="input-field appearance-none"
              value={profileForm.lga}
              onChange={(event) => updateProfileField('lga', event.target.value)}
              required
            >
              <option value="">Select local government</option>
              {localGovernments.map((lga) => (
                <option key={lga} value={lga}>{lga}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Street address</label>
            <input
              className="input-field"
              value={profileForm.address}
              onChange={(event) => updateProfileField('address', event.target.value)}
              placeholder="House number and street name"
              autoComplete="street-address"
              maxLength={500}
              required
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full sm:w-auto px-7 py-2.5 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>

        {/* Bio + stats */}
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="card">
            <h3 className="font-medium text-base mb-4">About</h3>
            <div className="form-group">
              <label className="label">Bio</label>
              <textarea
                className="input-field resize-y"
                rows={4}
                value={profileForm.bio}
                onChange={(event) => updateProfileField('bio', event.target.value)}
                placeholder="Tell clients a bit about yourself or your services..."
                maxLength={1000}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full sm:w-auto px-7 py-2.5 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save bio'}
            </button>
          </div>

          {user?.role === 'artisan' && (
            <Link href="/dashboard/verify-business" className="card block hover:ring-1 hover:ring-brand-500 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4"/>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">Get Verified</p>
                  <p className="text-xs text-slate-500">Verify your business to build trust with clients</p>
                </div>
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </Link>
          )}

          <div className="card">
            <h3 className="font-medium text-base mb-4">Account Info</h3>
            <div className="space-y-3">
              {[
                { label: 'Account Type', value: roleLabel },
                { label: 'City',         value: user?.city  ?? '-' },
                { label: 'Email',        value: user?.email ?? '-' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between text-sm py-2 border-b border-slate-200 last:border-0"
                >
                  <span className="text-slate-500 flex-shrink-0">{s.label}</span>
                  <span className="font-medium text-slate-900 truncate max-w-[55%] text-right">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>

            <details className="group mt-5 border-t border-slate-100 pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700">
                <span>Delete account</span>
                <svg className="h-4 w-4 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </summary>
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-xs leading-relaxed text-slate-600">
                  Delete your Anywork365 account and associated data. This action cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmation('')
                    setDeleteDialogOpen(true)
                  }}
                  disabled={deletingAccount}
                  className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                >
                  {deletingAccount ? 'Deleting...' : 'Delete account'}
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>

      {user?.role === 'professional' && (
        <section className="card mt-4 sm:mt-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Professional background</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Add your education, certifications and employment history for recruiters.
              </p>
            </div>
            <button
              type="button"
              onClick={handleProfessionalBackgroundSave}
              disabled={backgroundLoading || backgroundSaving}
              className="btn-primary w-full px-5 sm:w-auto"
            >
              {backgroundSaving ? 'Saving...' : 'Save background'}
            </button>
          </div>

          {backgroundLoading ? (
            <div className="space-y-4 py-6">
              <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <div className="space-y-8 pt-6">
              <div>
                <label htmlFor="professional-school" className="label">School or institution</label>
                <input
                  id="professional-school"
                  className="input-field"
                  value={schoolName}
                  onChange={(event) => setSchoolName(event.target.value)}
                  placeholder="For example, University of Lagos"
                  maxLength={220}
                  autoComplete="organization"
                />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Certifications</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Add the certification name and year obtained.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCertifications((items) => [...items, blankCertification()])}
                    disabled={certifications.length >= 20}
                    className="btn-ghost flex-shrink-0 px-3 py-2 text-xs"
                  >
                    + Add certification
                  </button>
                </div>

                {certifications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
                    No certifications added yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {certifications.map((certification, index) => (
                      <div key={certification.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Certification {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => setCertifications((items) => items.filter((item) => item.key !== certification.key))}
                            className="text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                          <div>
                            <label className="label" htmlFor={`certification-name-${certification.key}`}>Certification name</label>
                            <input
                              id={`certification-name-${certification.key}`}
                              className="input-field"
                              value={certification.name}
                              onChange={(event) => updateCertification(certification.key, { name: event.target.value })}
                              placeholder="For example, AWS Solutions Architect"
                              maxLength={180}
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor={`certification-year-${certification.key}`}>Year obtained</label>
                            <input
                              id={`certification-year-${certification.key}`}
                              className="input-field"
                              type="number"
                              inputMode="numeric"
                              min={1950}
                              max={CURRENT_YEAR}
                              value={certification.yearObtained}
                              onChange={(event) => updateCertification(certification.key, { yearObtained: Number(event.target.value) })}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Work experience</h3>
                    <p className="mt-0.5 text-xs text-slate-500">List your most relevant role first.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorkExperience((items) => [...items, blankWorkExperience()])}
                    disabled={workExperience.length >= 20}
                    className="btn-ghost flex-shrink-0 px-3 py-2 text-xs"
                  >
                    + Add experience
                  </button>
                </div>

                {workExperience.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
                    No work experience added yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workExperience.map((experience, index) => (
                      <div key={experience.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Experience {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => setWorkExperience((items) => items.filter((item) => item.key !== experience.key))}
                            className="text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="label" htmlFor={`experience-title-${experience.key}`}>Job title</label>
                            <input
                              id={`experience-title-${experience.key}`}
                              className="input-field"
                              value={experience.jobTitle}
                              onChange={(event) => updateWorkExperience(experience.key, { jobTitle: event.target.value })}
                              placeholder="Job title"
                              maxLength={160}
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor={`experience-employer-${experience.key}`}>Employer</label>
                            <input
                              id={`experience-employer-${experience.key}`}
                              className="input-field"
                              value={experience.employer}
                              onChange={(event) => updateWorkExperience(experience.key, { employer: event.target.value })}
                              placeholder="Company or organisation"
                              maxLength={180}
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor={`experience-start-${experience.key}`}>Start year</label>
                            <input
                              id={`experience-start-${experience.key}`}
                              className="input-field"
                              type="number"
                              inputMode="numeric"
                              min={1950}
                              max={CURRENT_YEAR}
                              value={experience.startYear}
                              onChange={(event) => updateWorkExperience(experience.key, { startYear: Number(event.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor={`experience-end-${experience.key}`}>End year</label>
                            <input
                              id={`experience-end-${experience.key}`}
                              className="input-field"
                              type="number"
                              inputMode="numeric"
                              min={experience.startYear || 1950}
                              max={CURRENT_YEAR}
                              value={experience.endYear ?? CURRENT_YEAR}
                              disabled={experience.current}
                              onChange={(event) => updateWorkExperience(experience.key, { endYear: Number(event.target.value) })}
                            />
                          </div>
                        </div>
                        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={experience.current}
                            onChange={(event) => updateWorkExperience(experience.key, {
                              current: event.target.checked,
                              endYear: event.target.checked ? undefined : (experience.endYear || CURRENT_YEAR),
                            })}
                            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                          />
                          I currently work here
                        </label>
                        <div className="mt-3">
                          <label className="label" htmlFor={`experience-description-${experience.key}`}>Responsibilities or achievements <span className="font-normal text-slate-400">(optional)</span></label>
                          <textarea
                            id={`experience-description-${experience.key}`}
                            className="input-field min-h-24 resize-y"
                            value={experience.description || ''}
                            onChange={(event) => updateWorkExperience(experience.key, { description: event.target.value })}
                            placeholder="Summarise your responsibilities and notable achievements"
                            maxLength={1200}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {(user?.role === 'artisan' || user?.role === 'professional') && (
        <section className="card mt-4 sm:mt-6">
          <div className="mb-5">
            <h2 className="font-medium text-base">Portfolio</h2>
            <p className="text-sm text-slate-500 mt-1">
              {user?.role === 'professional'
                ? 'Add projects with a title, description and optional project link.'
                : 'Add projects with a title, description, work photo and optional link.'}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div className="space-y-3">
              {user?.role === 'artisan' && (
                <>
                  <button
                    type="button"
                    onClick={() => portfolioInputRef.current?.click()}
                    className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 transition-colors hover:border-brand-500 hover:text-brand-600"
                  >
                    {portfolioPreview ? (
                      <Image
                        src={portfolioPreview}
                        alt="Portfolio preview"
                        width={640}
                        height={360}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span>Choose work photo</span>
                    )}
                  </button>
                  <input
                    ref={portfolioInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => handlePortfolioFile(event.target.files?.[0] || null)}
                  />
                </>
              )}
              <input
                className="input-field"
                value={portfolioTitle}
                onChange={(event) => setPortfolioTitle(event.target.value)}
                placeholder="Project title"
                maxLength={120}
              />
              <textarea
                className="input-field resize-y"
                rows={3}
                value={portfolioDescription}
                onChange={(event) => setPortfolioDescription(event.target.value)}
                placeholder="Briefly describe the work"
                minLength={20}
                maxLength={1000}
              />
              <input
                className="input-field"
                type="url"
                inputMode="url"
                value={portfolioLink}
                onChange={(event) => setPortfolioLink(event.target.value)}
                placeholder="Project or portfolio link (optional)"
                maxLength={1000}
              />
              <button
                type="button"
                onClick={handlePortfolioUpload}
                disabled={portfolioUploading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {portfolioUploading ? 'Adding...' : 'Add to portfolio'}
              </button>
            </div>

            <div>
              {portfolioLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[1, 2].map((item) => (
                    <div key={item} className="aspect-[4/3] animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : portfolio.length === 0 ? (
                <div className="flex min-h-44 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
                  Your work samples will appear here.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {portfolio.map((item) => (
                    <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          width={640}
                          height={480}
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center bg-brand-50 px-4 text-center text-sm font-semibold text-brand-700">
                          {item.title}
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-medium text-slate-900">{item.title}</h3>
                            {item.description && (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.description}</p>
                            )}
                            {item.projectUrl && (
                              <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-semibold text-brand-600 hover:text-brand-700">
                                Open project →
                              </a>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePortfolioDelete(item.id)}
                            className="flex-shrink-0 text-xs font-medium text-red-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <Modal
        open={deleteDialogOpen}
        onClose={() => {
          if (deletingAccount) return
          setDeleteDialogOpen(false)
          setDeleteConfirmation('')
        }}
        title="Delete your account?"
        size="sm"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleDeleteAccount()
          }}
          className="space-y-5"
        >
          <p className="text-sm leading-relaxed text-slate-600">
            Your profile and account data will be permanently deleted. This action cannot be undone.
          </p>

          <div>
            <label htmlFor="delete-account-confirmation" className="mb-2 block text-sm font-medium text-slate-800">
              Type <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">DELETE</span> to confirm
            </label>
            <input
              id="delete-account-confirmation"
              type="text"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              disabled={deletingAccount}
              autoComplete="off"
              className="input-field"
              placeholder="DELETE"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteConfirmation('')
              }}
              disabled={deletingAccount}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Keep my account
            </button>
            <button
              type="submit"
              disabled={deleteConfirmation.trim() !== 'DELETE' || deletingAccount}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
            >
              {deletingAccount ? 'Deleting...' : 'Delete account'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
