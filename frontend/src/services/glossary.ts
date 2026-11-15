// Plain-language definitions shown when a statistical term is hovered, focused or tapped.
// Source: docs/methodology.md, sections 5 and 8. Definitions only: never a result or a number from the data.

export type TermId =
  | 'sen_slope'
  | 'ci95'
  | 'per_decade'
  | 'p_value'
  | 'mann_kendall'
  | 'hamed_rao'
  | 'autocorrelation'
  | 'pettitt'
  | 'significant'
  | 'headline_box'

export const GLOSSARY: Record<TermId, { title: string; text: string }> = {
  sen_slope: {
    title: "Sen's slope",
    text: 'The size of the change in millimetres per year: the median of the slopes between every pair of years. Always shown, significant or not.',
  },
  ci95: {
    title: '95% interval',
    text: 'The range that the real change per year probably falls in. If it runs from a negative to a positive value, the change could go either way.',
  },
  per_decade: {
    title: 'Per decade',
    text: 'The change per year times ten, as a share of the mean annual total. It makes regions with very different rainfall comparable.',
  },
  p_value: {
    title: 'p-value',
    text: 'How surprising the pattern would be if there were no trend at all. Below 0.05, the result is called statistically significant. A higher value does not mean rainfall stayed the same.',
  },
  mann_kendall: {
    title: 'Mann-Kendall test',
    text: 'Asks whether later years tend to be higher (or lower) than earlier ones. It looks only at the order of the values, so one very wet year cannot dominate it.',
  },
  hamed_rao: {
    title: 'Hamed-Rao (modified Mann-Kendall)',
    text: "Used when one year's total is linked to the next. Then the plain test becomes too confident, and this version corrects for it.",
  },
  autocorrelation: {
    title: 'Lag-1 autocorrelation',
    text: "How strongly each year's total is linked to the year before. If the link is significant, the Hamed-Rao test becomes the primary test.",
  },
  pettitt: {
    title: 'Pettitt test',
    text: 'Looks for one year where the series jumps to a new level. A one-time step, for example the 2014 satellite change (TRMM to GPM), can look like a gradual trend.',
  },
  significant: {
    title: 'Statistically significant',
    text: 'The pattern is unlikely to be only year-to-year chance (p below 0.05). It describes the past record. It says nothing about the cause or about future years.',
  },
  headline_box: {
    title: 'Headline box',
    text: 'A box of 3 x 3 satellite cells (about 33 km) around the regional capital. Rainfall is averaged over the box: it is an area estimate, not a reading at one point.',
  },
}
