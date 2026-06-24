'use client'

import { useState } from 'react'
import Link from 'next/link'
import { JOB_CATEGORIES, NIGERIAN_STATE_NAMES, type NigerianState } from '@/types'
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
  const localGovernments = selectedState ? getLocalGovernments(selectedState) : []
  const hasFilters = Boolean(category || state || lga || search)

  return (
    <form
      className="mb-6 grid gap-3 border-y border-slate-200 bg-white py-4 md:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(150px,0.8fr))_auto]"
      method="GET"
    >
      <input
        name="search"
        defaultValue={search}
        className="input-field"
        placeholder="Name, skill, or keyword"
        aria-label="Search professionals"
      />
      <select name="category" defaultValue={category || ''} className="input-field appearance-none">
        <option value="">All categories</option>
        {JOB_CATEGORIES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <select
        name="state"
        value={selectedState}
        className="input-field appearance-none"
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
        className="input-field appearance-none disabled:bg-slate-50 disabled:text-slate-400"
        onChange={(event) => setSelectedLga(event.target.value)}
        disabled={!selectedState}
      >
        <option value="">All local governments</option>
        {localGovernments.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <div className="flex gap-2 md:col-span-2 lg:col-span-1">
        <button type="submit" className="btn-primary flex-1 px-5 lg:flex-none">Search</button>
        {hasFilters && <Link href="/professionals" className="btn-ghost px-4">Clear</Link>}
      </div>
    </form>
  )
}
