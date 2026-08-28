'use client'

import { useEffect, useRef, useState } from 'react'
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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!visible) return null

  return createPortal(
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-opacity duration-200',
        animating ? 'bg-slate-950/45 backdrop-blur-[3px]' : 'bg-transparent'
      )}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={cn(
        'bg-white w-full min-w-0 max-w-full max-h-[92dvh] overflow-x-hidden overflow-y-auto scroll-momentum',
        'rounded-t-3xl border border-white/60 sm:rounded-3xl',
        sizeMap[size],
        'shadow-[0_24px_70px_rgba(15,23,42,0.24)]',
        'transition-all duration-200',
        animating
          ? 'translate-y-0 opacity-100 sm:scale-100'
          : 'translate-y-8 opacity-0 sm:translate-y-0 sm:scale-95'
      )}>
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-500 via-brand-300 to-[#c9f58b]" />
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="font-display text-xl font-bold tracking-[-0.035em] text-slate-950 sm:text-2xl">{title}</h2>
          <button
            onClick={onClose}
            className="-mr-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="min-w-0 px-5 py-5 pb-8 sm:px-6 sm:pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
