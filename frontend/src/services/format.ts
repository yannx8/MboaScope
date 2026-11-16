// Display helpers only. Rounding is done by the backend; these just print.
import type { Verdict } from '../types/api'

const nf = new Intl.NumberFormat('en-GB')

export const num = (x: number | null | undefined): string => (x === null || x === undefined ? '–' : nf.format(x))

export const signed = (x: number): string => (x > 0 ? `+${nf.format(x)}` : x < 0 ? `−${nf.format(Math.abs(x))}` : '0')

export const pValue = (p: number): string => (p < 0.001 ? '< 0.001' : p.toFixed(3))

export const VERDICT_TEXT: Record<Verdict, string> = {
  significant_increase: 'Statistically significant increase',
  significant_decrease: 'Statistically significant decrease',
  no_significant_trend: 'No statistically significant trend',
}

export const VERDICT_TONE: Record<Verdict, 'wetter' | 'drier' | 'neutral'> = {
  significant_increase: 'wetter',
  significant_decrease: 'drier',
  no_significant_trend: 'neutral',
}

export const CAVEAT_TITLE: Record<string, string> = {
  sensor_change_2014: 'Satellite change in 2014',
  coastal_skill: 'Coastal location',
  short_record: 'Short record',
  area_estimate: 'Area estimate, not a station',
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SENSOR_CHANGE_YEAR = 2014

/** The primary p-value, as the contract defines it (docs/api.md). A lookup, not a computation. */
export const primaryP = (h: { mk_test_used: 'original' | 'hamed_rao'; mk_original: { p: number }; mk_hamed_rao: { p: number } }): number =>
  h.mk_test_used === 'hamed_rao' ? h.mk_hamed_rao.p : h.mk_original.p

export const testName = (used: 'original' | 'hamed_rao'): string =>
  used === 'hamed_rao' ? 'Modified Mann-Kendall (Hamed-Rao)' : 'Mann-Kendall'

export const VERDICT_SHORT: Record<Verdict, string> = {
  significant_increase: 'Significant increase',
  significant_decrease: 'Significant decrease',
  no_significant_trend: 'No significant trend',
}

/** One plain sentence for the answer card. Words only; the numbers sit next to it. */
export const VERDICT_PLAIN: Record<Verdict, string> = {
  significant_increase: 'The satellite record shows annual rainfall going up, and the rise is unlikely to be chance alone.',
  significant_decrease: 'The satellite record shows annual rainfall going down, and the fall is unlikely to be chance alone.',
  no_significant_trend:
    'The record cannot separate a steady rise or fall from ordinary year-to-year ups and downs. This is not the same as "no change".',
}

export const CAVEAT_TEXT: Record<string, string> = {
  sensor_change_2014: 'The satellites changed from TRMM to GPM in 2014. A step there can look like a trend.',
  coastal_skill: 'NASA reports lower satellite accuracy near the coast.',
  short_record: 'About 25 yearly values give the tests little power to detect a small change.',
  area_estimate: 'A satellite average over a box of about 33 km, not a reading at one point.',
}

export const BOX_NAME: Record<string, string> = {
  box_1x1: '1 x 1 cell (about 11 km)',
  box_3x3: '3 x 3 cells (about 33 km, headline)',
  box_5x5: '5 x 5 cells (about 55 km)',
}

export const periodLabel = (start: number, end: number): string => `${start} to ${end}`
