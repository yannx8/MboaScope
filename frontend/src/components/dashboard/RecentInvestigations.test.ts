import { describe, expect, it } from 'vitest'
import type { InvestigationLog } from '../../types/api'
import { latestPerInvestigation, timeAgo } from './RecentInvestigations'

const run = (id: number, region_id: string, start_year: number, created_at: string): InvestigationLog => ({
  id, region_id, start_year, end_year: 2024, verdict: 'no_significant_trend', p: 0.5, sen_slope_mm_per_year: 1, is_mock: true, created_at,
})

describe('recent investigations', () => {
  it('keeps the newest run of each region and period', () => {
    const log = [
      run(1, 'douala', 2001, '2026-11-15T10:00:00Z'),
      run(2, 'garoua', 2001, '2026-11-15T11:00:00Z'),
      run(3, 'douala', 2001, '2026-11-15T12:00:00Z'),
      run(4, 'douala', 2014, '2026-11-15T09:00:00Z'),
    ]
    expect(latestPerInvestigation(log, 10).map((i) => i.id)).toEqual([3, 2, 4])
    expect(latestPerInvestigation(log, 2).map((i) => i.id)).toEqual([3, 2])
  })

  it('says how long ago', () => {
    const now = Date.parse('2026-11-16T12:00:00Z')
    expect(timeAgo('2026-11-16T11:59:30Z', now)).toBe('just now')
    expect(timeAgo('2026-11-16T11:15:00Z', now)).toBe('45 min ago')
    expect(timeAgo('2026-11-16T07:00:00Z', now)).toBe('5 h ago')
    expect(timeAgo('2026-11-15T10:00:00Z', now)).toBe('yesterday')
    expect(timeAgo('2026-11-10T12:00:00Z', now)).toBe('6 days ago')
  })
})
