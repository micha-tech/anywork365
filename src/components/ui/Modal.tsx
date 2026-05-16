'use client'

import { useEffect, useRef, useState } from 'react'
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

  return (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-opacity duration-200',
        animating ? 'bg-black/40 backdrop-blur-sm' : 'bg-transparent'
      )}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={cn(
        'bg-white w-full max-h-[92dvh] overflow-y-auto',
        'rounded-t-2xl sm:rounded-2xl',
        sizeMap[size],
        'shadow-xl',
        'transition-all duration-200',
        animating
          ? 'translate-y-0 opacity-100 sm:scale-100'
          : 'translate-y-8 opacity-0 sm:translate-y-0 sm:scale-95'
      )}>
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-ui-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200">
          <h2 className="font-display font-semibold text-lg text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:bg-gray-100 transition-colors -mr-1.5"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 sm:px-6 py-5 pb-8 sm:pb-6">{children}</div>
      </div>
    </div>
  )
}
