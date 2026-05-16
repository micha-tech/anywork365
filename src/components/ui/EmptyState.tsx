export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: 'bookings' | 'jobs' | 'messages' | 'wallet' | 'search'
  title: string
  description?: string
  action?: React.ReactNode
}) {
  const icons: Record<string, React.ReactNode> = {
    bookings: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01" /><circle cx="8" cy="14" r=".5" fill="#94a3b8" />
        <path d="M12 14h.01" /><circle cx="12" cy="14" r=".5" fill="#94a3b8" />
        <path d="M16 14h.01" /><circle cx="16" cy="14" r=".5" fill="#94a3b8" />
      </svg>
    ),
    jobs: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="17" />
        <line x1="9.5" y1="14.5" x2="14.5" y2="14.5" />
      </svg>
    ),
    messages: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    wallet: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M16 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
    search: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        {icon ? icons[icon] : (
          <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><circle cx="12" cy="8" r=".5" fill="#94a3b8" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
