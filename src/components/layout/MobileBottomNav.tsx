'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'

export function MobileBottomNav() {
  const pathname = usePathname()
  const { user, loading } = useCurrentUser()
  const isVendor = user?.role === 'artisan'
  const isAdmin = user?.role === 'admin'
  const isSupport = user?.role === 'support'
  const hideOnPaths = pathname === '/login' || pathname.startsWith('/signup') || pathname === '/onboarding' || pathname === '/verify-email' || pathname.startsWith('/profile/setup') || pathname.startsWith('/support')

  if (loading || !user || hideOnPaths) return null

  if (isAdmin || isSupport) {
    return (
      <nav className="bottom-navigation fixed inset-x-0 bottom-0 z-40 pb-safe md:hidden">
        <div className="flex items-center justify-center px-2 h-16">
          <Link
            href={isSupport ? '/support' : '/admin'}
            className={cn(
              'flex flex-col items-center justify-center gap-1 transition-colors',
              pathname.startsWith(isSupport ? '/support' : '/admin') ? 'text-brand-500' : 'text-slate-500'
            )}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pathname.startsWith('/admin') ? 2.5 : 2} strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-[10px] font-medium">{isSupport ? 'Support' : 'Admin Panel'}</span>
            {pathname.startsWith(isSupport ? '/support' : '/admin') && (
              <span className="absolute -top-0.5 w-5 h-0.5 rounded-full bg-brand-500" />
            )}
          </Link>
          <Link
            href="/"
            className="flex flex-col items-center justify-center gap-1 transition-colors text-slate-500 ml-8"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="text-[10px] font-medium">Home</span>
          </Link>
        </div>
      </nav>
    )
  }

  const TABS = isVendor
    ? [
        {
          href: '/dashboard',
          label: 'Home',
          icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          ),
        },
        {
          href: '/artisans',
          label: 'Artisans',
          icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          ),
        },
        {
          href: '/messages',
          label: 'Messages',
          icon: (_active: boolean) => (
            <div className="contents">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
          ),
        },
        {
          href: '/jobs',
          label: 'Jobs',
          icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
          ),
        },
        {
          href: '/professionals',
          label: 'Professionals',
          icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round">
              <circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/>
              <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14c3 0 5 2 5 5"/>
            </svg>
          ),
        },
      ]
    : [
        { href: '/artisans', label: 'Artisans', icon: (active: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
        { href: '/jobs', label: 'Jobs', icon: (active: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> },
        { href: '/professionals', label: 'Professionals', icon: (active: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14c3 0 5 2 5 5"/></svg> },
        { href: '/messages', label: 'Messages', icon: (_active: boolean) => <div className="contents"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div> },
        { href: '/profile', label: 'Profile', icon: (active: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
      ]

  return (
    /* Visible only on mobile */
    <nav className="bottom-navigation fixed inset-x-0 bottom-0 z-40 pb-safe md:hidden">
      <div className="grid h-[76px] grid-cols-5 items-center px-1.5">
        {TABS.map((tab) => {
          const active = tab.href === '/dashboard'
            ? pathname === tab.href
            : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className="bottom-navigation-link"
            >
              <span className="nav-icon">{tab.icon(active)}</span>
              <span className="max-w-full text-[10px] font-semibold leading-tight min-[390px]:text-[11px]">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
