'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCurrentUser, getInitialsFromUser } from '@/hooks/useCurrentUser'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const PUBLIC_NAV = [
  { href: '/professionals', label: 'Find Vendors' },
  { href: '/jobs',          label: 'Browse Jobs' },
]

const AUTH_NAV = [
  { href: '/professionals', label: 'Find Vendors' },
  { href: '/jobs',           label: 'Browse Jobs' },
  { href: '/messages',      label: 'Messages' },
  { href: '/dashboard',     label: 'Dashboard' },
]

function NotificationBell({ unreadCount, onClick }: { unreadCount: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
      aria-label="Notifications"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
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
  const hideNavbar = pathname === '/login' || pathname === '/signup'

  const isLoggedIn = !loading && !!user
  const navLinks   = isLoggedIn ? AUTH_NAV : PUBLIC_NAV
  const initials   = getInitialsFromUser(user)

  const handleConversationOpen = useCallback((conversationId: string) => {
    router.push(`/messages?id=${conversationId}`)
  }, [router])

  usePushNotifications(handleConversationOpen)

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
    await fetch('/api/auth/me', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-16">

            <BrandLogo size="md" priority className="min-w-0 flex-1 md:flex-none" imageClassName="object-contain" />

            <nav className="hidden md:flex items-center gap-0.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'text-sm font-medium px-4 py-2 rounded-xl transition-all duration-150',
                    pathname.startsWith(link.href)
                      ? 'text-brand-600 bg-brand-50 font-semibold'
                      : 'text-slate-500 hover:text-brand-600 hover:bg-brand-50'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2">
              {isLoggedIn && (
                <NotificationBell unreadCount={unreadCount} onClick={() => router.push('/messages')} />
              )}
              {isLoggedIn ? (
                <div className="relative">
                  <button
                    onClick={() => setDropOpen(!dropOpen)}
                    className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {user?.avatarUrl
                        ? <Image src={user.avatarUrl} alt={initials} width={32} height={32} className="w-full h-full object-cover" unoptimized={user.avatarUrl.startsWith('/uploads/')} />
                        : <span>{initials}</span>}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{user?.firstName}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {dropOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-card-lg py-1.5 z-50">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-900">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs text-slate-400 capitalize mt-0.5">{user?.role}</p>
                      </div>
                      {[
                        { href: '/dashboard',        label: 'Dashboard' },
                        { href: '/messages',         label: 'Messages' },
                        { href: '/dashboard/wallet', label: 'Wallet' },
                        { href: '/dashboard/profile',label: 'My Profile' },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center px-4 py-2.5 text-sm text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
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
                <NotificationBell unreadCount={unreadCount} onClick={() => router.push('/messages')} />
              )}
              {isLoggedIn ? (
                <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-500 flex items-center justify-center text-white text-xs font-bold">
                  {user?.avatarUrl
                    ? <Image src={user.avatarUrl} alt={initials} width={32} height={32} className="w-full h-full object-cover" unoptimized={user.avatarUrl.startsWith('/uploads/')} />
                    : <span>{initials}</span>}
                </div>
              ) : pathname === '/' ? (
                <Link href="/signup" className="btn-primary-sm text-xs px-3 py-2">
                  Sign up
                </Link>
              ) : null}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
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
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="relative bg-white border-b border-slate-200 shadow-lg">
            <nav className="px-4 py-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                    pathname.startsWith(link.href)
                      ? 'bg-brand-50 text-brand-600 font-semibold'
                      : 'text-slate-700 hover:bg-brand-50 hover:text-brand-600'
                  )}
                >
                  {link.label}
                </Link>
              ))}

              {isLoggedIn && (
                <>
                  <div className="border-t border-slate-100 mt-2 pt-2">
                    {[
                      { href: '/dashboard/wallet',  label: 'Wallet' },
                      { href: '/dashboard/profile', label: 'My Profile' },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-600"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50"
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