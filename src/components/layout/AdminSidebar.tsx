'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCurrentUser, getInitialsFromUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/layout/BrandLogo'

const NAV_ITEMS = [
  {
    label: 'Management',
    links: [
      { href: '/admin', label: 'Overview', icon: GridIcon },
      { href: '/admin/users', label: 'Users', icon: UserIcon },
      { href: '/admin/reconciliation', label: 'Reconciliation', icon: WalletIcon },
      { href: '/admin/disputes', label: 'Disputes', icon: AlertIcon },
    ],
  },
  {
    label: 'Oversight',
    links: [
      { href: '/admin/analytics', label: 'Analytics', icon: ChartIcon },
      { href: '/admin/verifications', label: 'Verifications', icon: VerifyIcon },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { user, loading } = useCurrentUser()

  const initials = getInitialsFromUser(user)
  const fullName = user ? `${user.firstName} ${user.lastName}` : '...'

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
          <p className="text-xs text-slate-500">Admin</p>
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

      <div className="mt-auto pt-4 border-t border-slate-200 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-brand-50 hover:text-brand-500 transition-colors"
        >
          <HomeIcon className="w-4 h-4" />
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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
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

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
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

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
