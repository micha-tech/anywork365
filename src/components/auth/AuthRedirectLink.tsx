'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { getBrowserAuthRedirect, withAuthRedirect } from '@/lib/auth-redirect'

export function AuthRedirectLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const [destination, setDestination] = useState(href)

  useEffect(() => {
    setDestination(withAuthRedirect(href, getBrowserAuthRedirect()))
  }, [href])

  return <Link href={destination} className={className}>{children}</Link>
}
