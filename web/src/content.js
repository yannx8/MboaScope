// All visible text lives here (owner: Frontend).
// Rule: no number is ever typed in this file. Every number comes from the JSON
// files and is passed in to the small functions below.
// Wording follows the allowed / banned table in docs/SCIENCE.md.

export const content = {
  // 1. Header
  title: 'MboaScope',
  eyebrow: 'Mboa means home. Rainfall over Douala, Cameroon',
  navLabel: 'Sections',
  skip: 'Skip to the answer',
  nav: [
    { id: 'answer', label: 'Answer' },
    { id: 'chart', label: 'Trend' },
    { id: 'map', label: 'Map' },
    { id: 'robustness', label: 'Robustness' },
    { id: 'explanation', label: 'Explained' },
    { id: 'limitations', label: 'Limits' },
    { id: 'method', label: 'Method' },
  ],
  mockBadge: 'Demo data',
  question: 'Is Douala getting wetter or drier?',
  questionParts: ['Is Douala getting ', 'wetter', ' or ', 'drier', '?'],
  questionFr: 'Douala devient-elle plus humide ou plus sèche ?',
  sourceLabel: 'Source',
  sourceValue: 'NASA satellites',
  subtitle: 'What NASA satellite rainfall estimates say about the Douala area, and how sure we can be.',
  headerDataset: (shortName, version) => `NASA GPM IMERG Final, monthly, version ${version} (${shortName})`,
  headerPeriod: (start, end) => `${start} to ${end}`,
  datasetLabel: 'Dataset',
  periodLabel: 'Period',

  // 2. Mock banner
  mockBanner: 'Demo data, not real NASA results',
  mockBannerDetail: 'These numbers come from a synthetic test run. They will be replaced by the real satellite record.',

  // Generic states
  loading: 'Loading...',
  errorFile: (file) => `Could not load ${file}.json. This part of the page is unavailable.`,

  // 3. Answer card
  answerHeading: 'The answer',
  answerSub: 'Headline result, fixed in advance: one box, one dataset, one test.',
  verdict: {
    significant_increase: 'The satellite record shows a statistically significant increase in annual rainfall.',
    significant_decrease: 'The satellite record shows a statistically significant decrease in annual rainfall.',
    no_significant_trend: 'No statistically significant trend was detected in annual rainfall.',
  },
  verdictShort: {
    significant_increase: 'Significant increase',
    significant_decrease: 'Significant decrease',
    no_significant_trend: 'No significant trend',
  },
  verdictSymbol: {
    significant_increase: '+',
    significant_decrease: '-',
    no_significant_trend: '~',
  },
  verdictUnknown: 'Verdict not available.',
  slopeLabel: 'Estimated change',
  slopeUnit: 'mm per year',
  ciText: (lo, hi) => `95% confidence interval: ${lo} to ${hi} mm per year`,
  ciCrossesZero: 'The interval includes zero: the data are compatible with no change.',
  pctLabel: 'Relative change',
  pctUnit: '% per decade',
  pLabel: 'p-value',
  pHint: 'trend test',
  mmPerYear: 'mm per year',
  pettittLabel: 'Step change check',
  testLabel: 'Test used',
  yearsLabel: 'Years analysed',
  meanLabel: 'Mean annual total',
  mmUnit: 'mm',
  tests: {
    original: 'Mann-Kendall',
    hamed_rao: 'Mann-Kendall, Hamed-Rao modified (corrects for year-to-year memory)',
  },
  answerScope: (boxLabel) => `Satellite estimate averaged over the ${boxLabel}, not a rain gauge reading.`,
  pettittStep: (year, p) =>
    `A step change test points to ${year} as the most likely break (p = ${p}).`,
  pettittSensor: 'It coincides with the satellite transition and may be an artifact.',
  pettittNoStep: (year, p) => `A step change test finds no significant break (most likely year ${year}, p = ${p}).`,

  // 4. Annual chart
  chartHeading: 'Rainfall year by year',
  chartIntro: (boxLabel) => `Annual total rainfall over the ${boxLabel}. The line is the estimated trend (Sen's slope).`,
  chartBars: 'Annual total (mm)',
  chartLine: "Trend line (Sen's slope)",
  chartMarker: 'Satellite change (TRMM to GPM)',
  chartMarkerShort: 'Satellite change',
  chartMarkerNote: (year) =>
    `The satellite constellation behind IMERG changed in ${year} (TRMM to GPM). A jump at that point can look like a trend without being one.`,
  chartExcluded: (years) => `Years left out because months are missing: ${years}. They appear as gaps, never filled in.`,
  chartNoExcluded: 'No year is missing data.',
  chartAlt: (verdict, first, last, slope, lo, hi) =>
    `Bar chart of annual rainfall from ${first} to ${last}. ${verdict} Estimated change ${slope} mm per year (95% confidence interval ${lo} to ${hi}).`,
  tooltipTotal: 'Total',
  chartTableToggle: 'Show the yearly numbers',
  chartTableYear: 'Year',
  chartTableTotal: 'Total (mm)',
  chartTableExcluded: 'excluded',
  noBox: 'The headline box is missing from annual.json.',

  // 5. Map
  mapHeading: 'Where the signal is',
  mapIntro: (boxLabel) =>
    `The answer above uses the highlighted ${boxLabel}. The coloured grid runs the same test on each satellite cell separately.`,
  mapExploratory: (n, fp) => `Exploratory: ${n} separate tests, about ${fp} false positives expected by chance.`,
  mapSignificant: (k) => `${k} cells reach significance on their own. Expect some of those to be chance.`,
  mapNoneSignificant: 'No cell reaches significance on its own.',
  mapUnavailable: 'Trend map not available for this data source.',
  mapLegendDrier: '- Drier',
  mapLegendWetter: '+ Wetter',
  mapLegendNeutral: 'Near zero',
  mapLegendTitle: "Sen's slope, mm per year",
  mapLegendSignificant: 'Dark outline: cell significant on its own test',
  mapHeadlineBox: 'headline box',
  mapCellTooltip: (slope, p, mean) => `Slope ${slope} mm per year, p = ${p}, mean ${mean} mm per year`,
  mapLoading: 'Loading map...',
  placeLegend: 'Choose a place',
  placeDouala: 'Douala',
  // Short names for the picker; ids as proposed in issue #39. Unknown ids fall back to the box label.
  cityNames: {
    city_edea: 'Edéa',
    city_limbe: 'Limbe',
    city_kumba: 'Kumba',
    city_yaounde: 'Yaoundé',
    city_bafoussam: 'Bafoussam',
  },
  placeHeadlineTag: 'headline',
  placeExploratory: 'Exploratory city result',
  placeMultiple: (n, fp) => `One of ${n} extra city tests: about ${fp} false positives expected by chance across them.`,
  placeMultipleNoNumbers: 'One of several extra city tests: some significant results are expected by chance.',
  placeScope: 'A satellite estimate averaged over a box of about 33 km, not a local reading. The Douala answer above stays the headline.',
  mapA11y: 'Map of the Douala area with the study boxes and the per-cell trend grid. The same numbers are in the robustness table.',

  // 6. Robustness
  robustHeading: 'Does the answer depend on choices?',
  robustIntro:
    'We repeated the test with other box sizes and datasets. These rows only check robustness: the headline is fixed in advance and never swapped.',
  robustCols: ['Box', 'Dataset', 'Years', "Slope (mm/yr)", '95% interval', 'p', 'Result'],
  robustHeadlineTag: 'headline',
  robustEmpty: 'No sensitivity rows in this run.',

  // 7. Explanation
  explainHeading: 'In plain words',
  explainSub: 'Written from the numbers above. Every number is checked by code before it is shown.',
  explainSummary: 'Summary',
  explainMeans: 'What it means',
  explainNotMeans: 'What it does not mean',
  explainTag: {
    template: 'Template text',
    gemini: 'Rewritten by Gemini, numbers checked by code',
  },
  explainChecksFailed: 'Warning: the automatic number and wording checks did not pass for this text.',

  // 8. Limitations (fallback text is used only if explanation.json fails to load)
  limitsHeading: 'Limitations',
  limitsIntro: 'Read these before quoting any number from this page.',
  limitsFallback: [
    'The satellite constellation changed in the middle of the record (TRMM to GPM), which can create artifacts that look like a trend.',
    'IMERG has lower skill near the coast, and Douala sits on the Wouri estuary.',
    'A short record of annual values gives the test low statistical power.',
    'The numbers are a satellite estimate averaged over an area, not a local reading.',
  ],

  // 9. Method and data
  methodHeading: 'Method and data',
  methodSub: 'How the numbers were made, and where they come from.',
  methodSteps: [
    'Download monthly NASA GPM IMERG Final rain rates for the region.',
    'Convert mean rain rates to monthly totals, then sum each year for each box.',
    'Leave out any year with a missing month. Never fill it in.',
    "Test for a steady trend with Mann-Kendall and estimate its size with Sen's slope.",
    'Repeat with other boxes and datasets to check robustness.',
  ],
  methodText: 'The test, the box and the period were fixed before looking at any result.',
  methodDoi: 'Dataset DOI',
  methodAccess: 'Access method',
  methodPeriod: 'Period',
  methodGranules: 'Monthly files used',
  methodCommit: 'Code version',
  methodGenerated: 'Results generated',
  methodRead: 'Read the full method',
  methodRepo: 'Source code on GitHub',
  access: {
    earthaccess: 'NASA Earthdata (earthaccess), full grid',
    giovanni_csv: 'NASA Giovanni, area-averaged series (fallback)',
    mock: 'Synthetic mock data (not NASA data)',
  },

  // 10. Footer
  footerTeam: 'Team',
  team: ['Yann', 'Firmin', 'Theophile', 'Bako', 'Franck', 'Pavel'],
  footerEvent: 'Built for NASA Space Apps 2026',
  footerMade: 'Made in Cameroon, for the people of Douala.',
  challenge: null, // Lead fills in the official challenge name (issue #1)
  footerChallenge: (name) => `Challenge: ${name}`,
  footerData: 'Data: NASA GES DISC. Map tiles: OpenStreetMap contributors.',
  footerSource: 'Data and code',
}
