import { describe, expect, it } from 'vitest'
import { primaryP, pValue, signed } from './format'

describe('format', () => {
  it('prints signs with a real minus sign', () => {
    expect(signed(4.2)).toBe('+4.2')
    expect(signed(-5.4)).toBe('−5.4')
    expect(signed(0)).toBe('0')
  })
  it('prints small p-values as a bound', () => {
    expect(pValue(0.0004)).toBe('< 0.001')
    expect(pValue(0.042)).toBe('0.042')
  })
  it('picks the primary p-value the contract names', () => {
    const h = { mk_test_used: 'original' as const, mk_original: { p: 0.042 }, mk_hamed_rao: { p: 0.001 } }
    expect(primaryP(h)).toBe(0.042)
    expect(primaryP({ ...h, mk_test_used: 'hamed_rao' })).toBe(0.001)
  })
})
