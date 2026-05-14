import Image from 'next/image'
import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'green' | 'gray' | 'blue' | 'red' | 'amber'

const badgeVariants: Record<BadgeVariant, string> = {
  green: 'bg-brand-50 text-brand-500',
  gray: 'bg-gray-100 text-slate-500',
  blue: 'bg-blue-50 text-blue-700',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
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
      <div className={cn('overflow-hidden rounded-full bg-gray-100', sizeMap[size], className)}>
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
      <span className="text-sm text-amber-400">★</span>
      <span className="text-sm font-medium text-slate-900">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-sm text-slate-500">({count})</span>}
    </div>
  )
}

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon = '🔍', title, description, action }: EmptyStateProps) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mb-4 text-4xl">{icon}</div>
      <h3 className="mb-2 text-base font-medium text-slate-900">{title}</h3>
      {description && <p className="mb-6 text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  )
}
