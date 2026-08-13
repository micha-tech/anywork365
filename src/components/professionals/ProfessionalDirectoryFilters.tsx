'use client'

import { useState } from 'react'
import Link from 'next/link'
import { INDUSTRY_CATEGORIES } from '@/lib/registration-options'
import { NIGERIAN_STATE_NAMES } from '@/types'

interface ProfessionalDirectoryFiltersProps {
  search?: string
  industry?: string
  state?: string
}

export function ProfessionalDirectoryFilters({ search, industry, state }: ProfessionalDirectoryFiltersProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(Boolean(industry || state))
  const hasFilters = Boolean(search || industry || state)

  return (
    <form method="GET" className="mt-8 grid gap-3 border-y border-slate-200 py-4 sm:mt-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <input name="search" defaultValue={search} className="input-field" placeholder="Search name, job title, or specialty" aria-label="Search professionals" />
      <button
        type="button"
        className="flex min-h-11 items-center justify-between rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 md:hidden"
        onClick={() => setShowMobileFilters((value) => !value)}
        aria-expanded={showMobileFilters}
      >
        <span>Filters</span>
        <span className="text-xs font-medium text-brand-600">{showMobileFilters ? 'Hide' : 'Industry & location'}</span>
      </button>
      <div className={`${showMobileFilters ? 'grid' : 'hidden'} gap-3 md:contents`}>
        <select name="industry" defaultValue={industry} className="input-field appearance-none">
          <option value="">All industries</option>
          {INDUSTRY_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select name="state" defaultValue={state} className="input-field appearance-none">
          <option value="">All states</option>
          {NIGERIAN_STATE_NAMES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <button type="submit" className="btn-primary px-5">Find</button>
        {hasFilters && <Link href="/professionals" className="btn-ghost px-4">Clear</Link>}
      </div>
    </form>
  )
}
