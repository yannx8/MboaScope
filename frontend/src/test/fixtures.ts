// Response shapes copied from docs/api.md. Test inputs only, not results.
import type { InterpretResponse, RainfallSeriesResponse, Region, TrendsResponse } from '../types/api'

export const region = (id: string, name: string, lat: number, extra: Partial<Region> = {}): Region => ({
  id,
  name,
  admin_region: 'Test',
  centre: [lat, 12],
  coastal: false,
  verified: false,
  boxes: { box_3x3: { label: `${name}, 3 x 3 cells (about 33 km)`, bounds: [lat - 0.15, lat + 0.15, 11.85, 12.15] } },
  grid_bounds: [lat - 0.45, lat + 0.45, 11.55, 12.45],
  has_data: true,
  access_method: 'mock',
  period: ['2001-01', '2025-12'],
  ...extra,
})

export const REGIONS: Region[] = [
  region('douala', 'Douala', 4.05, { coastal: true, verified: true }),
  region('garoua', 'Garoua', 9.35),
  region('bertoua', 'Bertoua', 4.55, { has_data: false, access_method: null, period: null }),
]

export function trends(regionId: string, name: string, verdict: TrendsResponse['headline']['verdict'] = 'significant_decrease'): TrendsResponse {
  return {
    api_version: '2.0',
    generated_at: '2026-11-15T00:00:00Z',
    is_mock: true,
    investigation_id: 1,
    headline: {
      region_id: regionId,
      region_name: name,
      box: 'box_3x3',
      dataset: 'IMERG V07',
      period: '2001-2025',
      n_years: 25,
      alpha: 0.05,
      mean_annual_mm: 959,
      lag1_autocorr: 0.19,
      autocorr_significant: false,
      mk_test_used: 'original',
      mk_original: { tau: -0.29, z: -2.03, p: 0.042, trend: 'decreasing' },
      mk_hamed_rao: { z: -3.24, p: 0.001, trend: 'decreasing' },
      sen_slope_mm_per_year: -5.4,
      sen_intercept_mm: 1030,
      sen_ci95: [-10.2, -0.1],
      pct_per_decade: -5.7,
      pettitt: { change_year: 2013, k: 78, p: 0.11, significant: false },
      verdict,
      caveats: ['sensor_change_2014', 'short_record', 'area_estimate'],
    },
    sensitivity: [],
  }
}

export const SERIES: RainfallSeriesResponse = {
  api_version: '2.0',
  generated_at: '2026-11-15T00:00:00Z',
  is_mock: true,
  region_id: 'garoua',
  region_name: 'Garoua',
  box: 'box_3x3',
  box_label: 'Garoua, 3 x 3 cells (about 33 km)',
  bounds: [9.2, 9.5, 13.2, 13.5],
  period: [2001, 2025],
  years: Array.from({ length: 25 }, (_, i) => ({ year: 2001 + i, total_mm: 900 + i, months_present: 12, complete: true })),
  excluded_years: [],
  climatology: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, mean_mm: 10 * i })),
  warnings: [],
  provenance: {
    dataset: 'GPM IMERG Final',
    short_name: 'GPM_3IMERGM',
    version: '07',
    doi: '10.5067/GPM/IMERG/3B-MONTH/07',
    access_method: 'mock',
    source_units: 'mm/hr',
    period: ['2001-01', '2025-12'],
    granule_count: 300,
    notes: [],
  },
}

export const INTERPRET: InterpretResponse = {
  api_version: '2.0',
  generated_at: '2026-11-15T00:00:00Z',
  is_mock: true,
  region_id: 'garoua',
  explanation: {
    source: 'template',
    model: null,
    checks_passed: true,
    summary: 'For 2001-2025, the satellite record shows a statistically significant decrease in annual rainfall.',
    what_it_means: 'Means text.',
    what_it_does_not_mean: 'Does not mean text.',
    limitations: ['One.', 'Two.', 'Three.'],
  },
  notes: [],
  suggestions: [
    { title: 'Repeat the test on the GPM era only', reason: 'Because.', region_id: 'garoua', start_year: 2014, end_year: 2025 },
  ],
}
