import { describe, expect, it } from 'vitest'
import { SERIES } from '../test/fixtures'
import { annualCsv, DEMO_WARNING, fileStem } from './exportData'

describe('exports', () => {
  it('writes the API values unchanged, one row per year, with the source', () => {
    const csv = annualCsv(SERIES).trim().split('\n')
    const header = csv.indexOf('year,total_mm,months_present,complete')
    expect(header).toBeGreaterThan(0)
    expect(csv.slice(header + 1)).toEqual(SERIES.years.map((y) => `${y.year},${y.total_mm},${y.months_present},${y.complete}`))
    expect(csv.join('\n')).toContain(SERIES.provenance.doi)
  })

  it('carries the demo warning when the data is mock, and only then', () => {
    expect(annualCsv({ ...SERIES, is_mock: true })).toContain(DEMO_WARNING)
    expect(annualCsv({ ...SERIES, is_mock: false })).not.toContain(DEMO_WARNING)
  })

  it('builds safe file names', () => {
    expect(fileStem('garoua', 2001, 2024)).toBe('mboascope_garoua_2001-2024')
    expect(fileStem('../x y', 2001, 2024)).toBe('mboascope_xy_2001-2024')
  })
})
