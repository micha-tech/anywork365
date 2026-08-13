'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useCurrentUser, getInitialsFromUser } from '@/hooks/useCurrentUser'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { useAppPushNotifications } from '@/hooks/useAppPushNotifications'
import { logoutCurrentUser } from '@/lib/clientLogout'

const PUBLIC_NAV = [
  { href: '/artisans', label: 'Artisans' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/professionals', label: 'Professionals' },
]

const AUTH_NAV = [
  { href: '/artisans', label: 'Artisans' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/professionals', label: 'Professionals' },
  { href: '/bookings', label: 'Bookings' },
  { href: '/messages', label: 'Messages' },
]

const VENDOR_AUTH_NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/artisans', label: 'Artisans' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/professionals', label: 'Professionals' },
  { href: '/dashboard/bookings', label: 'Bookings' },
  { href: '/messages', label: 'Messages' },
]

const RECRUITER_AUTH_NAV = [
  { href: '/artisans', label: 'Artisans' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/professionals', label: 'Professionals' },
  { href: '/dashboard/post-job', label: 'Post Job' },
  { href: '/dashboard/applications', label: 'Applications' },
]

const ADMIN_NAV = [
  { href: '/admin', label: 'Admin Panel' },
]

const SUPPORT_NAV = [
  { href: '/support', label: 'Support Console' },
]

function NotificationBell({ unreadCount, onClick }: { unreadCount: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-brand-600"
      aria-label="Notifications"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

export function Navbar() {
  const pathname           = usePathname()
  const router             = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { user, loading }  = useCurrentUser()
  const hideNavbar = pathname === '/login' || pathname.startsWith('/signup') || pathname === '/onboarding' || pathname.startsWith('/support')

  const isLoggedIn = !loading && !!user
  const isAdmin    = user?.role === 'admin'
  const isSupport  = user?.role === 'support'
  const isVendor   = user?.role === 'artisan'
  const isRecruiter = user?.role === 'recruiter'
  const isProfessional = user?.role === 'professional'
  const navLinks   = isAdmin ? ADMIN_NAV : isSupport ? SUPPORT_NAV : isLoggedIn ? (isVendor ? VENDOR_AUTH_NAV : isRecruiter ? RECRUITER_AUTH_NAV : AUTH_NAV) : PUBLIC_NAV
  const initials   = getInitialsFromUser(user)

  const handleConversationOpen = useCallback((conversationId: string) => {
    router.push(`/messages?id=${conversationId}`)
  }, [router])

  useAppPushNotifications(handleConversationOpen)

  useEffect(() => {
    if (!user) return

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications')
        if (!res.ok) return
        const data = await res.json()
        if (data.success) setUnreadCount(data.data.unreadCount)
      } catch {
        // silently fail
      }
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => { setMenuOpen(false); setDropOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  if (hideNavbar) return null

  async function handleLogout() {
    setDropOpen(false)
    setMenuOpen(false)
    await logoutCurrentUser()
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <header className="navbar sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-16">

            <BrandLogo size="md" priority imageClassName="object-contain" />

            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'relative px-3.5 py-5 text-sm font-medium transition-colors duration-150 after:absolute after:inset-x-3.5 after:bottom-0 after:h-0.5 after:origin-left after:bg-brand-500 after:transition-transform',
                    pathname.startsWith(link.href)
                      ? 'font-semibold text-brand-600 after:scale-x-100'
                      : 'text-slate-600 after:scale-x-0 hover:text-brand-600'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2">
              {isLoggedIn && (
                <NotificationBell unreadCount={unreadCount} onClick={() => router.push(isVendor ? '/dashboard/notifications' : '/notifications')} />
              )}
              {isLoggedIn ? (
                <div className="relative">
                  <button
                    onClick={() => setDropOpen(!dropOpen)}
                    className="flex items-center gap-2 rounded-xl border border-transparent py-1.5 pl-1.5 pr-3 transition-colors hover:border-slate-200 hover:bg-slate-50"
                  >
                    <Avatar src={user?.avatarUrl} initials={initials} size="sm" className="font-bold" />
                    <span className="text-sm font-medium text-slate-700">{user?.firstName}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {dropOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200/90 bg-white py-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                      <div className="border-b border-slate-100 px-4 py-3.5">
                        <p className="text-sm font-semibold text-slate-900">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs text-slate-400 capitalize mt-0.5">{user?.role}</p>
                      </div>
                      {(isAdmin ? [
                        { href: '/admin', label: 'Admin Panel' },
                      ] : isSupport ? [
                        { href: '/support', label: 'Support Console' },
                      ] : isVendor ? [
                        { href: '/dashboard', label: 'Dashboard' },
                        { href: '/artisans', label: 'Artisans' },
                        { href: '/jobs', label: 'Jobs' },
                        { href: '/professionals', label: 'Professionals' },
                        { href: '/messages', label: 'Messages' },
                        { href: '/dashboard/wallet', label: 'Wallet' },
                        { href: '/dashboard/profile', label: 'My Profile' },
                      ] : isRecruiter ? [
                        { href: '/artisans', label: 'Artisans' },
                        { href: '/jobs', label: 'Jobs' },
                        { href: '/professionals', label: 'Professionals' },
                        { href: '/dashboard/post-job', label: 'Post Job' },
                        { href: '/dashboard/jobs', label: 'Posted Jobs' },
                        { href: '/dashboard/applications', label: 'Applications' },
                        { href: '/profile', label: 'My Profile' },
                      ] : isProfessional ? [
                        { href: '/artisans', label: 'Artisans' },
                        { href: '/jobs', label: 'Jobs' },
                        { href: '/professionals', label: 'Professionals' },
                        { href: '/messages', label: 'Messages' },
                        { href: '/profile', label: 'My Profile' },
                      ] : [
                        { href: '/artisans', label: 'Artisans' },
                        { href: '/jobs', label: 'Jobs' },
                        { href: '/professionals', label: 'Professionals' },
                        { href: '/bookings', label: 'Bookings' },
                        { href: '/messages', label: 'Messages' },
                        { href: '/wallet', label: 'Wallet' },
                        { href: '/profile', label: 'My Profile' },
                      ]).map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="mx-1.5 flex items-center rounded-lg px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
                        >
                          {item.label}
                        </Link>
                      ))}
                      {user?.canSwitchClientRecruiter && (
                        <Link
                          href="/profile#account-mode"
                          className="mx-1.5 flex items-center rounded-lg bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                        >
                          Switch account type
                        </Link>
                      )}
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="mx-1.5 w-[calc(100%-0.75rem)] rounded-lg px-3 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                        >
                          Log out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                pathname === '/' && (
                  <div className="flex items-center gap-2">
                    <Link href="/login"  className="btn-ghost text-sm py-2">Log in</Link>
                    <Link href="/signup" className="btn-primary text-sm py-2">Sign up</Link>
                  </div>
                )
              )}
            </div>

            <div className="flex md:hidden flex-shrink-0 items-center gap-1.5">
              {isLoggedIn && (
                <NotificationBell unreadCount={unreadCount} onClick={() => router.push(isVendor ? '/dashboard/notifications' : '/notifications')} />
              )}
              {isLoggedIn ? (
                <Avatar src={user?.avatarUrl} initials={initials} size="sm" className="font-bold" />
              ) : pathname === '/' ? (
                <Link href="/signup" className="btn-primary-sm text-xs px-3 py-2">
                  Sign up
                </Link>
              ) : null}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-600"
              >
                {menuOpen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="3" y1="6"  x2="21" y2="6"/>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                )}
              </button>
            </div>

          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" style={{ top: '64px' }}>
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)} />
          <div className="relative border-b border-slate-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.10)]">
            <nav className="flex flex-col gap-1 px-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                    pathname.startsWith(link.href)
                      ? 'bg-brand-50 text-brand-600 font-semibold'
                      : 'text-slate-700 hover:bg-brand-50 hover:text-brand-600'
                  )}
                >
                  {link.label}
                </Link>
              ))}

              {isLoggedIn && !isAdmin && (
                <>
                  <div className="border-t border-slate-100 mt-2 pt-2">
                    {[
                      ...(isVendor
                        ? [
                            { href: '/dashboard/wallet', label: 'Wallet' },
                            { href: '/dashboard/profile', label: 'My Profile' },
                          ]
                        : isProfessional || isRecruiter
                          ? [
                              { href: '/profile', label: 'My Profile' },
                            ]
                          : [
                            { href: '/wallet', label: 'Wallet' },
                            { href: '/profile', label: 'My Profile' },
                            ]),
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-600"
                      >
                        {item.label}
                      </Link>
                    ))}
                    {user?.canSwitchClientRecruiter && (
                      <Link
                        href="/profile#account-mode"
                        className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        Switch account type
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Log out
                    </button>
                  </div>
                </>
              )}

              {!isLoggedIn && pathname === '/' && (
                <div className="border-t border-slate-100 mt-2 pt-3 flex flex-col gap-2">
                  <Link href="/login"  className="btn-ghost w-full justify-center py-3">Log in</Link>
                  <Link href="/signup" className="btn-primary w-full justify-center py-3">Sign up</Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}

      {dropOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setDropOpen(false)} />
      )}
    </>
  )
}
