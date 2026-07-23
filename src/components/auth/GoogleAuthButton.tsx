'use client'

import Image from 'next/image'

type GoogleAuthButtonProps = {
  onClick: () => void
  loading?: boolean
  label?: string
  disabled?: boolean
}

export function GoogleAuthButton({
  onClick,
  loading = false,
  label = 'Continue with Google',
  disabled = false,
}: GoogleAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Image
        src="https://developers.google.com/identity/images/g-logo.png"
        alt=""
        width="18"
        height="18"
        aria-hidden="true"
      />
      <span>{loading ? 'Connecting to Google...' : label}</span>
    </button>
  )
}

export function AuthDivider({ label = 'or continue with email' }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden="true">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  )
}
