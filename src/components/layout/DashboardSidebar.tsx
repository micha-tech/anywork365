'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui'
import { useCurrentUser, getInitialsFromUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { logoutCurrentUser } from '@/lib/clientLogout'

const VENDOR_NAV = [
  {
    label: 'Main',
    links: [
      { href: '/dashboard', label: 'Overview', icon: GridIcon },
      { href: '/dashboard/bookings', label: 'Bookings', icon: BookingsIcon },
      { href: '/messages', label: 'Messages', icon: ChatIcon },
    ],
  },
  {
    label: 'Business',
    links: [
      { href: '/dashboard/my-business', label: 'Business Profile', icon: StoreIcon },
      { href: '/dashboard/verify-business', label: 'Verification', icon: VerifyIcon },
    ],
  },
  {
    label: 'Account',
    links: [
      { href: '/dashboard/wallet', label: 'Wallet', icon: WalletIcon },
      { href: '/dashboard/notifications', label: 'Notifications', icon: BellIcon },
      { href: '/dashboard/profile', label: 'My Profile', icon: UserIcon },
    ],
  },
]

const RECRUITER_NAV = [
  {
    label: 'Recruitment',
    links: [
      { href: '/dashboard/jobs', label: 'Posted Jobs', icon: BriefcaseIcon },
      { href: '/dashboard/post-job', label: 'Post Job', icon: PlusIcon },
      { href: '/dashboard/applications', label: 'Applications', icon: UserIcon },
      { href: '/messages', label: 'Messages', icon: ChatIcon },
    ],
  },
  {
    label: 'Marketplace',
    links: [
      { href: '/artisans', label: 'Artisans', icon: StoreIcon },
      { href: '/jobs', label: 'Jobs', icon: BriefcaseIcon },
      { href: '/professionals', label: 'Professionals', icon: UserIcon },
    ],
  },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useCurrentUser()

  const initials = getInitialsFromUser(user)
  const fullName = user ? `${user.firstName} ${user.lastName}` : '...'
  const role = user ? (user.role === 'artisan' ? 'Artisan' : user.role === 'professional' ? 'Professional' : user.role === 'recruiter' ? 'Recruiter' : user.role === 'admin' ? 'Admin' : 'Client') : ''
  const isVendor = user?.role === 'artisan'
  const isRecruiter = user?.role === 'recruiter'
  const isAdmin = user?.role === 'admin'
  const nav = isVendor ? VENDOR_NAV : isRecruiter ? RECRUITER_NAV : []

  async function handleLogout() {
    await logoutCurrentUser()
    router.push('/')
    router.refresh()
  }

  return (
    <aside className="hidden min-h-[calc(100dvh-64px)] w-64 flex-shrink-0 flex-col border-r border-slate-200/80 bg-white/90 px-3 py-6 shadow-[1px_0_3px_rgba(15,23,42,0.03)] backdrop-blur md:flex">
      <div className="mb-4 border-b border-slate-100 px-3 pb-5">
        <BrandLogo size="md" imageClassName="max-w-[185px] object-contain" />
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-100/80 bg-brand-50/70 px-3 py-3.5">
        <Avatar
          src={loading ? undefined : user?.avatarUrl}
          initials={loading ? '...' : initials}
          size="sm"
          className="h-9 w-9"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {loading ? 'Loading...' : fullName}
          </p>
          <p className="text-xs text-slate-500 capitalize">{role}</p>
        </div>
      </div>

      {isAdmin ? (
        <div className="mb-4">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Admin
          </p>
          <Link
            href="/admin"
            className={cn(
              'mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-brand-500 text-white font-semibold shadow-[0_5px_14px_rgba(15,79,74,0.16)]'
                : 'text-slate-600 hover:bg-brand-50 hover:text-brand-600'
            )}
          >
            <ShieldIcon className="w-4 h-4 flex-shrink-0" />
            Admin Panel
          </Link>
        </div>
      ) : (
        nav?.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {section.label}
            </p>
            {section.links.map((link) => {
              const Icon = link.icon
              const active = pathname === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors',
                    active
                      ? 'bg-brand-500 text-white font-semibold shadow-[0_5px_14px_rgba(15,79,74,0.16)]'
                      : 'text-slate-600 hover:bg-brand-50 hover:text-brand-600'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {link.label}
                </Link>
              )
            })}
          </div>
        ))
      )}

      <div className="mt-auto border-t border-slate-100 pt-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-brand-50 hover:text-brand-500 transition-colors"
        >
          <HomeIcon className="w-4 h-4" />
          Back to Home
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogoutIcon className="w-4 h-4" />
          Log out
        </button>
      </div>
    </aside>
  )
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M16 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
      <path d="M2 10h20" />
    </svg>
  )
}

function BookingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01" /><circle cx="8" cy="14" r=".5" fill="currentColor" />
      <path d="M12 14h.01" /><circle cx="12" cy="14" r=".5" fill="currentColor" />
      <path d="M16 14h.01" /><circle cx="16" cy="14" r=".5" fill="currentColor" />
      <path d="M8 18h.01" /><circle cx="8" cy="18" r=".5" fill="currentColor" />
      <path d="M12 18h.01" /><circle cx="12" cy="18" r=".5" fill="currentColor" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

function VerifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4" />
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
