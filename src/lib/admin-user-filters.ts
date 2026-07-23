import type { SqlValue } from '@/lib/db'

const ADMIN_USER_ROLES = ['admin', 'artisan', 'professional', 'recruiter', 'client'] as const

export function buildAdminUserFilter(searchInput: string, roleInput: string): {
  where: string
  params: SqlValue[]
} {
  const search = searchInput.trim().slice(0, 200)
  const role = roleInput.trim().toLowerCase()
  let where = 'WHERE u.deleted = 0'
  const params: SqlValue[] = []

  if (search) {
    where += ' AND (u.fullName LIKE ? OR u.email LIKE ? OR u.uid LIKE ?)'
    const query = `%${search}%`
    params.push(query, query, query)
  }

  if ((ADMIN_USER_ROLES as readonly string[]).includes(role)) {
    if (role === 'admin') {
      where += " AND u.role = 'admin'"
    } else if (role === 'artisan') {
      where += ' AND (u.role = ? OR (u.role IS NULL AND u.hasBusinessAccount = 1))'
      params.push('artisan')
    } else if (role === 'client') {
      where += ' AND (u.role = ? OR (u.role IS NULL AND u.hasBusinessAccount = 0))'
      params.push('client')
    } else {
      where += ' AND u.role = ?'
      params.push(role)
    }
  }

  return { where, params }
}
