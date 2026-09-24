import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export { Avatar } from './Avatar'

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

interface VerifiedBusinessBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  label?: boolean
  size?: 'sm' | 'md'
}

export function VerifiedBusinessBadge({
  label = true,
  size = 'md',
  className,
  ...props
}: VerifiedBusinessBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  return (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded-full bg-green-600 font-semibold text-white',
        label
          ? size === 'sm'
            ? 'gap-1 px-2 py-0.5 text-[11px]'
            : 'gap-1.5 px-2.5 py-1 text-xs'
          : size === 'sm'
            ? 'h-4 w-4'
            : 'h-6 w-6',
        className
      )}
      title="Verified business"
      aria-label="Verified business"
      {...props}
    >
      <svg className={iconSize} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8 8.08a1 1 0 0 1-1.42 0l-4-4.04a1 1 0 1 1 1.42-1.408L8 12.66l7.296-7.364a1 1 0 0 1 1.408-.006Z" clipRule="evenodd" />
      </svg>
      {label && <span>Verified</span>}
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
        hover && 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]',
        className
      )}
      {...props}
    >
      {children}
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

export { EmptyState } from './EmptyState'
export { SectionHeader } from './SectionHeader'
export { IconButton } from './IconButton'
