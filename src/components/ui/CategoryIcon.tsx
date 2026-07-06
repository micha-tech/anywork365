'use client'

import { type ReactNode } from 'react'

interface CategoryIconProps {
  category: string
  size?: number
}

const ICONS: Record<string, ReactNode> = {
  'Carpentry & Furniture': (
    <path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-7h6v7M8 9h8" />
  ),
  'Plumbing Services': (
    <path d="M6 8h8a4 4 0 0 1 4 4v2M6 8V4h5v4M18 14h2v5h-5v-5h3ZM4 8h2m4 0v5a3 3 0 0 0 3 3h2" />
  ),
  'Electrical Installation & Repairs': (
    <path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z" />
  ),
  'Painting & Wall Finishing': (
    <path d="M4 7h10v5H4V7Zm10 2h3a3 3 0 0 1 0 6h-3m-5-3v8m-2 0h4" />
  ),
  'Masonry, Tiling & Flooring': (
    <path d="M4 5h16v14H4V5Zm0 7h16M9 5v7m6 0v7" />
  ),
  'Roofing & Waterproofing': (
    <path d="M3 11 12 4l9 7M5 10v10h14V10M9 20v-6h6v6" />
  ),
  'Welding & Metal Fabrication': (
    <path d="M4 17h7M6 14l-2 3 2 3M13 7l4 4m0-4-4 4m2-8v3m5 5h3m-7 7v3m-5-10H8" />
  ),
  'Aluminium & Glass Works': (
    <path d="M4 4h16v16H4V4Zm8 0v16M4 12h16" />
  ),
  'POP, Ceiling & Partitioning': (
    <path d="M4 5h16M5 9h14M6 13h12M8 17h8M12 5v12" />
  ),
  'Interior Decoration & Space Styling': (
    <path d="M5 20V8l7-4 7 4v12M8 20v-7h8v7M9 10h6" />
  ),
  'HVAC / AC Installation & Repairs': (
    <path d="M4 8h16v8H4V8Zm3 4h2m5 0h3m-9 7v2m8-2v2M8 5V3m8 2V3" />
  ),
  'Generator, Inverter & Solar Services': (
    <path d="M4 10h16v9H4v-9Zm3 3h3m6 0h1M8 10V7a4 4 0 0 1 8 0v3M9 4l1-2m4 0 1 2" />
  ),
  'Pest Control & Fumigation': (
    <path d="M8 9a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0V9Zm4-6v3M5 8l3 2m11-2-3 2M5 16l3-2m11 2-3-2M8 12h8" />
  ),
  'Security Systems & CCTV': (
    <path d="M4 8h10v6H4V8Zm10 2 6-3v8l-6-3M8 14v4h5" />
  ),
  'Auto Mechanics': (
    <path d="M5 16h14M6 16l1.5-5h9L18 16M8 16v2m8-2v2M7 11l2-4h6l2 4" />
  ),
  'Freight Forwarding / Clearing Agents': (
    <path d="M3 16V7h11v9M14 10h4l3 4v2h-7m-8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
  ),
  'Logistics / Transportation Services': (
    <path d="M4 17V6h10v11M14 10h4l3 4v3h-7M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 10h4" />
  ),
  'Home Tutors': (
    <path d="M4 6h7a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3H4V6Zm16 0h-6a3 3 0 0 0-3 3" />
  ),
  'Technical Engineering Services': (
    <path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Zm-3 9h6m-3-3v6" />
  ),
  'Digital Printing Services': (
    <path d="M6 9V4h12v5M6 18H4v-7h16v7h-2M7 15h10v6H7v-6Zm11-1h.01" />
  ),
  'Tax / Accounting Consultancy': (
    <path d="M6 3h12v18H6V3Zm3 4h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01" />
  ),
  'Legal Consultancy': (
    <path d="M12 3v18M6 7h12M7 7l-4 7h8L7 7Zm10 0-4 7h8l-4-7ZM9 21h6" />
  ),
  'Quantity Surveying': (
    <path d="M5 4h14v16H5V4Zm3 4h8M8 12h3m3 0h2M8 16h3m3 0h2" />
  ),
  'Tailoring & Fashion Design': (
    <path d="M8 4 4 7l3 4 1-1v10h8V10l1 1 3-4-4-3a4 4 0 0 1-8 0Zm2 11h4" />
  ),
  'Digital Marketing': (
    <path d="M4 13h4l8-6v10l-8-4H4V8h4m0 5v5a2 2 0 0 0 2 2h1" />
  ),
  'Website & App Development': (
    <path d="M4 5h16v14H4V5Zm4 5-2 2 2 2m8-4 2 2-2 2m-2-6-4 8" />
  ),
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
