import type { UserRole } from '@/types'

export function getPostLoginPath(role?: UserRole | null): string {
  if (role === 'admin') return '/moderation'
  if (role === 'support') return '/support'
  if (role === 'artisan') return '/dashboard'
  if (role === 'professional') return '/professionals'
  if (role === 'recruiter') return '/dashboard/jobs'
  if (role === 'intern') return '/intern'
  return '/artisans'
}

export function getPostSignupPath(role?: UserRole | null): string {
  if (role === 'artisan' || role === 'professional') return '/profile/setup'
  return getPostLoginPath(role)
}
