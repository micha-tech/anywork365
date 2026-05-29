import Image from 'next/image'
import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'green' | 'gray' | 'blue' | 'red' | 'amber'

const badgeVariants: Record<BadgeVariant, string> = {
  green: 'bg-brand-50 text-brand-600 border border-brand-100',
  gray: 'bg-slate-100 text-slate-600 border border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border border-blue-100',
  red: 'bg-red-50 text-red-600 border border-red-100',
  amber: 'bg-amber-50 text-amber-700 border border-amber-100',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'gray', className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('badge', badgeVariants[variant], className)} {...props}>
      {children}
    </span>
  )
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md'
  hover?: boolean
}

export function Card({ size = 'md', hover = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        size === 'sm' ? 'card-sm' : 'card',
        hover && 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const AVATAR_COLORS = [
  'bg-brand-500',
  'bg-blue-600',
  'bg-purple-600',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-600',
  'bg-indigo-600',
]

interface AvatarProps {
  initials: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  colorIndex?: number
  className?: string
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

export function Avatar({ initials, src, size = 'md', colorIndex = 0, className }: AvatarProps) {
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]

  if (src) {
    return (
      <div className={cn('overflow-hidden rounded-full bg-slate-100', sizeMap[size], className)}>
        <Image
          src={src}
          alt={initials}
          width={80}
          height={80}
          className="h-full w-full object-cover"
          unoptimized={src.startsWith('/uploads/')}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white overflow-hidden',
        sizeMap[size],
        color,
        className
      )}
    >
      <span className="leading-none">{initials}</span>
    </div>
  )
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg className="h-4 w-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 0 0 .95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 0 0-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 0 0-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 0 0-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 0 0 .95-.69l1.07-3.29Z" />
      </svg>
      <span className="text-sm font-medium text-slate-900">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-sm text-slate-500">({count})</span>}
    </div>
  )
}

type EmptyIconName = 'bookings' | 'jobs' | 'messages' | 'wallet' | 'search'

interface EmptyStateProps {
  icon?: EmptyIconName | ReactNode
  title: string
  description?: string
  action?: ReactNode
}

const emptyIcons: Record<EmptyIconName, ReactNode> = {
  bookings: (
    <svg className="h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  ),
  jobs: (
    <svg className="h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  messages: (
    <svg className="h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  wallet: (
    <svg className="h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M18 13.5h.01" />
    </svg>
  ),
  search: (
    <svg className="h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
}

export function EmptyState({ icon = 'search', title, description, action }: EmptyStateProps) {
  const iconNode = typeof icon === 'string' ? emptyIcons[icon as EmptyIconName] ?? emptyIcons.search : icon

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100">
        {iconNode}
      </div>
      <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
