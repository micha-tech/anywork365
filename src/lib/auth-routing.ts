import type { UserRole } from '@/types'

export function getPostLoginPath(role?: UserRole | null): string {
  if (role === 'admin') return '/admin'
  if (role === 'artisan') return '/dashboard'
  if (role === 'professional') return '/professionals'
  if (role === 'recruiter') return '/dashboard/jobs'
  return '/artisans'
}
