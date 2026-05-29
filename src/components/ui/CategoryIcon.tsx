'use client'

import { type ReactNode } from 'react'

interface CategoryIconProps {
  category: string
  size?: number
}

const ICONS: Record<string, ReactNode> = {
  'Repair services': (
    <path d="M14.7 6.3a4 4 0 0 0-5 5l-5.4 5.4a1.4 1.4 0 0 0 2 2l5.4-5.4a4 4 0 0 0 5-5l-2.5 2.5-2-2 2.5-2.5Z" />
  ),
  'Environmental services': (
    <path d="M5 19c7.5-.5 12.5-5.4 14-14-8.6 1.5-13.5 6.5-14 14Zm0 0 8-8" />
  ),
  'Cleaning services': (
    <path d="M7 21h10l-1.5-7h-7L7 21Zm2-7 2-10h2l2 10M6 21h12" />
  ),
  'Events and rentals': (
    <path d="M12 3v18M6 7h12M5 21h14M8 7l-2 8h12l-2-8" />
  ),
  'Fashion services': (
    <path d="M8 4 4 7l3 4 1-1v10h8V10l1 1 3-4-4-3a4 4 0 0 1-8 0Z" />
  ),
  'Spa and beauty parlour': (
    <path d="M12 21s7-4.4 7-10a7 7 0 1 0-14 0c0 5.6 7 10 7 10Zm0-10 2-2m-2 2-2-2m2 2v5" />
  ),
  'General services': (
    <path d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3M10 11v5M14 11v5" />
  ),
  'Computer operation': (
    <path d="M4 5h16v11H4V5Zm5 16h6m-3-5v5" />
  ),
  'Restaurant and lounges': (
    <path d="M7 3v8m4-8v8M7 7h4m6-4v18M5 21h14" />
  ),
  'Lifestyle and entertainment': (
    <path d="M9 18V5l10-2v13M9 9l10-2M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  ),
  'Tradesmen and retailers': (
    <path d="M4 9h16l-1.5 11h-13L4 9Zm3 0a5 5 0 0 1 10 0" />
  ),
  'Professional services': (
    <path d="M4 8h16v11H4V8Zm5 0V5h6v3M4 13h16" />
  ),
  'Healthcare services': (
    <path d="M12 5v14M5 12h14" />
  ),
  'Software development': (
    <path d="m8 9-4 3 4 3m8-6 4 3-4 3M14 5l-4 14" />
  ),
}

export function CategoryIcon({ category, size = 48 }: CategoryIconProps) {
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-brand-500 text-white shadow-[0_10px_22px_rgba(15,79,74,0.16)]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.54}
        height={size * 0.54}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[category] ?? <path d="M12 3v18M3 12h18" />}
      </svg>
    </div>
  )
}

export const CATEGORY_ICONS = Object.keys(ICONS)
