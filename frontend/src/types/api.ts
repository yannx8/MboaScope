// Mirrors backend/app/schemas/*.py. If the backend contract changes, change this file in the same PR.
// The frontend displays these numbers as they arrive: it never recomputes statistics.

export type Verdict = 'no_significant_trend' | 'significant_increase' | 'significant_decrease'
export type TrendWord = 'increasing' | 'decreasing' | 'no trend'
export type Bounds = [south: number, north: number, west: number, east: number]

export interface Envelope {
  api_version: string
  generated_at: string
  is_mock: boolean
}

export interface InvestigationRequest {
  region_id: string
  start_year: number
  end_year: number
}

// ---------------------------------------------------------------- regions
export interface BoxInfo {
  label: string
  bounds: Bounds
}

export interface Region {
  id: string
  name: string
  admin_region: string
  centre: [number, number]
  coastal: boolean
  verified: boolean
  boxes: Record<string, BoxInfo>
  grid_bounds: Bounds
  has_data: boolean
  access_method: string | null
  period: [string, string] | null
}

export interface RegionsResponse {
  regions: Region[]
}

// ---------------------------------------------------------------- rainfall
export interface AnnualPoint {
  year: number
  total_mm: number
  months_present: number
  complete: boolean
}

export interface ClimatologyPoint {
  month: number
  mean_mm: number
}

export interface Provenance {
  dataset: string
  short_name: string
  version: string
  doi: string
  access_method: string
  source_units: string
  period: [string, string]
  granule_count: number
  notes: string[]
}

export interface RainfallSeriesResponse extends Envelope {
  region_id: string
  region_name: string
  box: string
  box_label: string
  bounds: Bounds
  period: [number, number]
  years: AnnualPoint[]
  excluded_years: number[]
  climatology: ClimatologyPoint[]
  warnings: string[]
  provenance: Provenance
}

// ---------------------------------------------------------------- analysis
export interface Headline {
  region_id: string
  region_name: string
  box: string
  dataset: string
  period: string
  n_years: number
  alpha: number
  mean_annual_mm: number
  lag1_autocorr: number
  autocorr_significant: boolean
  mk_test_used: 'original' | 'hamed_rao'
  mk_original: { tau: number; z: number; p: number; trend: TrendWord }
  mk_hamed_rao: { z: number; p: number; trend: TrendWord }
  sen_slope_mm_per_year: number
  sen_intercept_mm: number
  sen_ci95: [number, number]
  pct_per_decade: number
  pettitt: { change_year: number; k: number; p: number; significant: boolean }
  verdict: Verdict
  caveats: string[]
}

export interface SensitivityRow {
  box: string
  dataset: string
  n_years: number
  p: number
  sen_slope_mm_per_year: number
  sen_ci95: [number, number]
  verdict: Verdict
}

export interface TrendsResponse extends Envelope {
  investigation_id: number
  headline: Headline
  sensitivity: SensitivityRow[]
}

export interface SpatialCell {
  lat: number
  lon: number
  mean_annual_mm: number
  sen_slope_mm_per_year: number
  p: number
}

export interface SpatialResponse extends Envelope {
  region_id: string
  grid_bounds: Bounds
  exploratory: boolean
  available: boolean
  n_cells: number
  alpha: number
  expected_false_positives: number
  n_significant: number
  cells: SpatialCell[]
}

export interface InvestigationLog {
  id: number
  region_id: string
  start_year: number
  end_year: number
  verdict: Verdict
  p: number
  sen_slope_mm_per_year: number
  is_mock: boolean
  created_at: string
}

// ---------------------------------------------------------------- AI
export interface Explanation {
  source: 'template' | 'gemini'
  model: string | null
  checks_passed: boolean
  summary: string
  what_it_means: string
  what_it_does_not_mean: string
  limitations: string[]
}

export interface Suggestion {
  title: string
  reason: string
  region_id: string | null
  start_year: number
  end_year: number
}

export interface InterpretResponse extends Envelope {
  region_id: string
  explanation: Explanation
  notes: string[]
  suggestions: Suggestion[]
}

// New: free-text question (task B9). See docs/api.md, POST /api/ai/ask.
export interface AskRequest extends InvestigationRequest {
  question: string
  use_llm?: boolean
}

export interface Answer {
  source: 'rules' | 'gemini' | 'refusal'
  model: string | null
  answered: boolean
  text: string
}

export interface AskResponse extends Envelope {
  region_id: string
  question: string
  answer: Answer
  notes: string[]
}
