import { getByState } from 'nigeria-lga-data'
import type { NigerianState } from '@/types'

function toDatasetState(state: NigerianState): string {
  return state === 'FCT' ? 'Federal Capital Territory' : state
}

export function getLocalGovernments(state: NigerianState): string[] {
  return getByState(toDatasetState(state))
    .map((lga) => lga.name)
    .sort((a, b) => a.localeCompare(b))
}

export function isLocalGovernmentInState(state: NigerianState, lga: string): boolean {
  return getLocalGovernments(state).includes(lga)
}
