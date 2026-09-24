'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const [animating, setAnimating] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      requestAnimationFrame(() => setAnimating(true))
    } else {
      setAnimating(false)
      const t = setTimeout(() => setVisible(false), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open || !visible) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter(node => node.getClientRects().length > 0)
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open, visible])

  if (!visible) return null

  return createPortal(
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 transition-opacity duration-200',
        animating ? 'bg-slate-950/50' : 'bg-transparent'
      )}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={cn(
        'bg-white w-full min-w-0 max-w-full max-h-[92dvh] overflow-x-hidden overflow-y-auto scroll-momentum',
        'rounded-t-[var(--radius-sheet)] sm:rounded-[var(--radius-surface)] outline-none',
        sizeMap[size],
        'shadow-dialog',
        'transition-all duration-200',
        animating
          ? 'translate-y-0 opacity-100 sm:scale-100'
          : 'translate-y-8 opacity-0 sm:translate-y-0 sm:scale-95'
      )}>
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-8 sm:pt-8">
          <h2 id={titleId} className="pt-1 font-display text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
          <button
            onClick={onClose}
            className="icon-button"
            type="button"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="min-w-0 px-5 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
