import { describe, expect, it } from 'vitest'
import { FIRST_YEAR, LAST_YEAR, periodIsValid, yearParam } from './useInvestigation'

describe('years from the URL', () => {
  it('keeps a valid year', () => {
    expect(yearParam('2010', FIRST_YEAR)).toBe(2010)
  })
  it('falls back on missing or broken values', () => {
    expect(yearParam(null, FIRST_YEAR)).toBe(FIRST_YEAR)
    expect(yearParam('', LAST_YEAR)).toBe(LAST_YEAR)
    expect(yearParam('abc', LAST_YEAR)).toBe(LAST_YEAR)
    expect(yearParam('2010.5', FIRST_YEAR)).toBe(FIRST_YEAR)
  })
  it('keeps years inside the data range', () => {
    expect(yearParam('1990', FIRST_YEAR)).toBe(FIRST_YEAR)
    expect(yearParam('2040', LAST_YEAR)).toBe(LAST_YEAR)
  })
  it('rejects periods shorter than ten years', () => {
    expect(periodIsValid({ region_id: 'douala', start_year: 2016, end_year: 2025 })).toBe(true)
    expect(periodIsValid({ region_id: 'douala', start_year: 2017, end_year: 2025 })).toBe(false)
  })
})
