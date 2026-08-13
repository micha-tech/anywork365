'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BUSINESS_CATEGORY_GROUPS, NIGERIAN_STATE_NAMES, type NigerianState } from '@/types'
import { getLocalGovernments } from '@/lib/nigeria-locations'

interface ProfessionalFiltersProps {
  category?: string
  state?: string
  lga?: string
  search?: string
}

export function ProfessionalFilters({ category, state, lga, search }: ProfessionalFiltersProps) {
  const initialState = NIGERIAN_STATE_NAMES.includes(state as NigerianState)
    ? state as NigerianState
    : ''
  const [selectedState, setSelectedState] = useState<NigerianState | ''>(initialState)
  const [selectedLga, setSelectedLga] = useState(lga || '')
  const [showMobileFilters, setShowMobileFilters] = useState(hasActiveSecondaryFilters(category, state, lga))
  const localGovernments = selectedState ? getLocalGovernments(selectedState) : []
  const hasFilters = Boolean(category || state || lga || search)

  return (
    <form
      className="mb-6 grid min-w-0 gap-3 border-y border-slate-200 py-4 md:sticky md:top-[64px] md:z-30 md:grid-cols-2 md:bg-white/95 md:backdrop-blur md:supports-[backdrop-filter]:bg-white/90 lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(150px,0.8fr))_auto]"
      method="GET"
    >
      <div className="relative">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          name="search"
          defaultValue={search}
          className="input-field pl-10"
          placeholder="Search service or artisan"
          aria-label="Search artisans"
        />
      </div>
      <button
        type="button"
        className="flex min-h-11 items-center justify-between rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 md:hidden"
        onClick={() => setShowMobileFilters((value) => !value)}
        aria-expanded={showMobileFilters}
      >
        <span>Filters</span>
        <span className="text-xs font-medium text-brand-600">{showMobileFilters ? 'Hide' : 'Category & location'}</span>
      </button>

      <div className={`${showMobileFilters ? 'grid' : 'hidden'} gap-3 md:contents`}>
        <select name="category" defaultValue={category || ''} className="input-field appearance-none truncate">
          <option value="">All categories</option>
          {BUSINESS_CATEGORY_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          name="state"
          value={selectedState}
          className="input-field appearance-none truncate"
          onChange={(event) => {
            setSelectedState(event.target.value as NigerianState | '')
            setSelectedLga('')
          }}
        >
          <option value="">All states</option>
          {NIGERIAN_STATE_NAMES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select
          name="lga"
          value={selectedLga}
          className="input-field appearance-none truncate disabled:bg-slate-50 disabled:text-slate-400"
          onChange={(event) => setSelectedLga(event.target.value)}
          disabled={!selectedState}
        >
          <option value="">All local governments</option>
          {localGovernments.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:col-span-2 lg:col-span-1">
        <button type="submit" className="btn-primary min-w-0 px-5 lg:flex-none">Find</button>
        {hasFilters && <Link href="/artisans" className="btn-ghost px-4">Clear</Link>}
      </div>
    </form>
  )
}

function hasActiveSecondaryFilters(category?: string, state?: string, lga?: string) {
  return Boolean(category || state || lga)
}
