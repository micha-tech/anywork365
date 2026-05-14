'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
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
    href: '/dashboard/jobs',
    label: 'My Jobs',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/post-job',
    label: 'Post Job',
    icon: () => (
      <div className="w-11 h-11 rounded-full bg-brand-500 flex items-center justify-center shadow-md -mt-5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
    ),
  },
  {
    href: '/dashboard/wallet',
    label: 'Wallet',
    icon: (_active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={_active ? 2.5 : 2} strokeLinecap="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <path d="M16 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/>
        <path d="M2 10h20"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    /* Visible only on mobile */
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-safe">
      <div className="grid grid-cols-5 items-end px-2 h-16">
        {TABS.map((tab) => {
          const active = tab.href === '/dashboard'
            ? pathname === tab.href
            : pathname.startsWith(tab.href)
          const isPost = tab.href === '/dashboard/post-job'
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 h-full transition-colors min-w-0',
                isPost ? 'relative' : '',
                active && !isPost ? 'text-brand-500' : 'text-slate-500'
              )}
            >
              {tab.icon(active)}
              {!isPost && (
                <span className={cn('text-[10px] font-medium truncate', active ? 'text-brand-500' : 'text-slate-500')}>
                  {tab.label}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
