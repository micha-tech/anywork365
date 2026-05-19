import { getSession } from './auth'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

export async function requireAdmin(): Promise<{ id: string; email: string; firstName: string; lastName: string }> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    redirect('/dashboard')
  }
  return session
}

export async function requireAdminApi(): Promise<{ id: string; email: string }> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }
  return session
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
}

export async function logAdminAction(
  adminUid: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { execute } = await import('./db')
  await execute(
    'INSERT INTO admin_audit_log (adminUid, action, targetType, targetId, details) VALUES (?, ?, ?, ?, ?)',
    [adminUid, action, targetType ?? null, targetId ?? null, details ? JSON.stringify(details) : null]
  )
}
