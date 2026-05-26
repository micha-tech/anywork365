import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toErrorMessage } from './errors'
export { toErrorMessage }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getInitials(firstName: string, lastName: string): string {
  const f = firstName?.[0] ?? ''
  const l = lastName?.[0] ?? ''
  if (!l) return `${f}${f || ''}`.toUpperCase()
  return `${f}${l}`.toUpperCase()
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffHrs < 1) return 'Just now'
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}
