'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCurrentUser, getInitialsFromUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/layout/BrandLogo'

const NAV_ITEMS = [
  {
    label: 'Main',
    links: [
      { href: '/dashboard', label: 'Overview', icon: GridIcon },
      { href: '/dashboard/jobs', label: 'My Jobs', icon: BriefcaseIcon },
      { href: '/dashboard/bookings', label: 'My Bookings', icon: BookingsIcon },
      { href: '/dashboard/post-job', label: 'Post a Job', icon: PlusIcon },
      { href: '/messages', label: 'Messages', icon: ChatIcon },
    ],
  },
  {
    label: 'Account',
    links: [
      { href: '/dashboard/wallet', label: 'Wallet', icon: WalletIcon },
      { href: '/dashboard/profile', label: 'My Profile', icon: UserIcon },
    ],
  },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { user, loading } = useCurrentUser()

  const initials = getInitialsFromUser(user)
  const fullName = user ? `${user.firstName} ${user.lastName}` : '...'
  const role = user ? (user.role === 'vendor' ? 'Vendor' : 'User') : ''

  return (
    <aside className="hidden md:flex flex-col w-56 flex-shrink-0 bg-white border-r border-slate-200 min-h-[calc(100dvh-64px)] py-6 px-3">
      <div className="px-3 pb-4 mb-2 border-b border-slate-200">
        <BrandLogo size="md" imageClassName="max-w-[185px] object-contain" />
      </div>

      <div className="flex items-center gap-3 px-3 pb-5 mb-2 border-b border-slate-200">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {loading ? '...' : user?.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={initials}
              width={36}
              height={36}
              className="w-full h-full object-cover"
              unoptimized={user.avatarUrl.startsWith('/uploads/')}
            />
          ) : (
            <span className="leading-none">{initials}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {loading ? 'Loading...' : fullName}
          </p>
          <p className="text-xs text-slate-500 capitalize">{role}</p>
        </div>
      </div>

      {NAV_ITEMS.map((section) => (
        <div key={section.label} className="mb-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 px-3 mb-1.5">
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
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm mb-0.5 transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-500 font-medium'
                    : 'text-slate-500 hover:bg-brand-50 hover:text-brand-500'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {link.label}
              </Link>
            )
          })}
        </div>
      ))}

      <div className="mt-auto pt-4 border-t border-slate-200">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-brand-50 hover:text-brand-500 transition-colors"
        >
          <LogoutIcon className="w-4 h-4" />
          Back to Home
        </Link>
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

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
