import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { InvestigationRequest, Region } from '../types/api'
import { useApi } from './useApi'

export const FIRST_YEAR = 2001
export const LAST_YEAR = 2024 // keep equal to END_YEAR in backend/app/core/config.py
export const MIN_YEARS = 10
const DEFAULT_REGION = 'douala'

interface InvestigationContextValue {
  regions: Region[]
  regionsError: string | null
  region: Region | null
  request: InvestigationRequest
  setRequest: (next: Partial<InvestigationRequest>) => void
}

const InvestigationContext = createContext<InvestigationContextValue | null>(null)

/**
 * The current investigation (region + period) lives in the URL (?region=douala&from=2001&to=2024),
 * so every page shares it and a link reproduces exactly what the user saw.
 */
export function InvestigationProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const regions = useApi(() => api.regions(), [])

  const request: InvestigationRequest = {
    region_id: params.get('region') ?? DEFAULT_REGION,
    start_year: Number(params.get('from') ?? FIRST_YEAR),
    end_year: Number(params.get('to') ?? LAST_YEAR),
  }

  const value = useMemo<InvestigationContextValue>(() => {
    const list = regions.data?.regions ?? []
    return {
      regions: list,
      regionsError: regions.error,
      region: list.find((r) => r.id === request.region_id) ?? null,
      request,
      setRequest: (next) => {
        const merged = { ...request, ...next }
        const p = new URLSearchParams(location.search)
        p.set('region', merged.region_id)
        p.set('from', String(merged.start_year))
        p.set('to', String(merged.end_year))
        // Stay on the current page. (setSearchParams here would resolve against "/",
        // because this provider sits outside <Routes>.)
        navigate({ pathname: location.pathname, search: `?${p}` }, { replace: true })
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions.data, regions.error, request.region_id, request.start_year, request.end_year, location.pathname])

  return <InvestigationContext.Provider value={value}>{children}</InvestigationContext.Provider>
}

export function useInvestigation(): InvestigationContextValue {
  const ctx = useContext(InvestigationContext)
  if (!ctx) throw new Error('useInvestigation must be used inside <InvestigationProvider>')
  return ctx
}

/** True when the period is long enough for the backend to accept it. */
export function periodIsValid(r: InvestigationRequest): boolean {
  return r.end_year - r.start_year + 1 >= MIN_YEARS
}
