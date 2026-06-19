'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui'
import { NIGERIAN_STATE_NAMES } from '@/types'
import { useCurrentUser, getInitialsFromUser } from '@/hooks/useCurrentUser'

const MAX_AVATAR_DIMENSION = 512
const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024
const AVATAR_IMAGE_TYPE = 'image/webp'
const AVATAR_IMAGE_QUALITY = 0.82

async function optimizeAvatarFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read image'))
      img.src = objectUrl
    })

    const maxSourceDimension = Math.max(image.naturalWidth, image.naturalHeight)
    const scale = Math.min(1, MAX_AVATAR_DIMENSION / maxSourceDimension)
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return file

    context.drawImage(image, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, AVATAR_IMAGE_TYPE, AVATAR_IMAGE_QUALITY)
    })

    if (!blob) return file

    const optimizedType = blob.type || AVATAR_IMAGE_TYPE
    const extension = optimizedType === 'image/webp' ? 'webp' : file.name.split('.').pop() || 'jpg'
    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'avatar'
    const optimizedFile = new File([blob], `${baseName}.${extension}`, {
      type: optimizedType,
      lastModified: Date.now(),
    })

    return optimizedFile.size < file.size || maxSourceDimension > MAX_AVATAR_DIMENSION
      ? optimizedFile
      : file
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export default function ProfilePage() {
  const { user, loading }   = useCurrentUser()
  const fileInputRef        = useRef<HTMLInputElement>(null)

  // Photo state
  const [photoUrl,      setPhotoUrl]      = useState<string | null>(null)
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null)
  const [uploading,     setUploading]     = useState(false)
  const [dragOver,      setDragOver]      = useState(false)

  // Form state

  const initials    = getInitialsFromUser(user)
  const fullName    = user ? `${user.firstName} ${user.lastName}` : ''
  const roleLabel   = user?.role === 'vendor' ? 'Vendor' : 'User'
  // Show uploaded photo, else existing avatarUrl from session, else null (shows initials)
  const displayPhoto = photoUrl ?? user?.avatarUrl ?? null

  // ─── Handle file selection (from input or drag-drop) ─────────────────────

  const handleFile = useCallback(async (file: File) => {
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!ALLOWED.includes(file.type)) {
      toast.error('Only JPEG, PNG, or WebP images are allowed.')
      return
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      toast.error('Image must be smaller than 15MB.')
      return
    }

    // Show local preview immediately for snappy UX
    const objectUrl = URL.createObjectURL(file)
    setPhotoPreview(objectUrl)
    setUploading(true)

    try {
      const uploadFile = await optimizeAvatarFile(file)
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

  function removePhoto() {
    setPhotoUrl(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Save profile ─────────────────────────────────────────────────────────

  function handleSave() {
    toast.success('Profile saved')
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

  return (
    <>
      <div className="mb-5 sm:mb-7">
        <h1 className="font-display text-xl sm:text-2xl font-semibold">My Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your personal information</p>
      </div>

      {/* ── Profile header ───────────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

          {/* Avatar with overlay edit button */}
          <div className="relative flex-shrink-0 group">
            {currentPhoto ? (
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 ring-2 ring-slate-200">
                <Image
                  src={currentPhoto}
                  alt={fullName}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  unoptimized={currentPhoto.startsWith('/uploads/')}
                />
              </div>
            ) : (
              <Avatar initials={initials} size="xl" colorIndex={0} />
            )}

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

            {/* Remove button when photo exists */}
            {currentPhoto && !uploading && (
              <button
                onClick={removePhoto}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold shadow hover:bg-red-600 transition-colors"
                aria-label="Remove photo"
              >
                ×
              </button>
            )}
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
                defaultValue={user?.firstName ?? ''}
                placeholder="First name"
                autoComplete="given-name"
              />
              <input
                className="input-field"
                defaultValue={user?.lastName ?? ''}
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
              defaultValue={user?.email ?? ''}
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label className="label">Phone number</label>
            <input
              className="input-field"
              type="tel"
              inputMode="tel"
              defaultValue={user?.phone ?? ''}
              placeholder="+234 800 000 0000"
            />
          </div>
          <div className="form-group">
            <label className="label">City</label>
            <select className="input-field appearance-none" defaultValue={user?.city ?? NIGERIAN_STATE_NAMES[0]}>
              {NIGERIAN_STATE_NAMES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button onClick={handleSave} className="btn-primary w-full sm:w-auto px-7 py-2.5">
            Save changes
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
                defaultValue={user?.bio ?? ''}
                placeholder="Tell clients a bit about yourself or your services..."
              />
            </div>
            <button onClick={handleSave} className="btn-primary w-full sm:w-auto px-7 py-2.5">
              Save
            </button>
          </div>

          {user?.role === 'vendor' && (
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
          </div>
        </div>
      </div>
    </>
  )
}
