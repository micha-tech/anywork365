import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function HomeRedirectPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (!session.emailVerified) {
    redirect('/verify-email')
  }

  if (session.role === 'admin') {
    redirect('/admin')
  }

  if (session.role === 'artisan') {
    redirect('/dashboard')
  }

  redirect('/artisans')
}
