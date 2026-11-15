# Methodology: what MboaScope does, and what it may claim

Owner: Developer A (science rules), Developer B (plain-language wording and AI section).
The code follows this page. If they disagree, the code is wrong.

## 1. Question

Does the NASA satellite record show a statistically detectable monotonic trend in annual rainfall over a
selected region of Cameroon, in a selected period (default 2001-2024), and how confident can we be?

The headline test is fixed before looking at the data: one dataset, one box, one significance level (0.05).
Everything else is a robustness check and is never promoted to the headline.

## 2. Data

- **Primary:** GPM IMERG Final, monthly, Version 07 (`GPM_3IMERGM`), NASA GES DISC,
  DOI [10.5067/GPM/IMERG/3B-MONTH/07](https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07).
  Grid 0.1 degree (about 11 km). Available from June 2000, about 4 months behind real time.
  **V07 Final stops during 2025** (NASA is moving IMERG to Version 8), so 2025 is incomplete and the
  study ends in 2024. V08 must never be joined to the V07 series; switching means rerunning everything on V08.
- The file stores a **mean precipitation rate** (check the `units` attribute; usually mm/hr), not a total.
- **Optional cross-check:** GPCP monthly V3.3 (0.5 degree, different inputs).
- **Never** use TRMM 3B43 (discontinued 31 December 2019) and never join two products into one series:
  a jump at the join would look like a trend.

## 3. Study regions and boxes

One study region per regional capital (`data/regions/cameroon_study_regions.json`). Each is defined by
the IMERG cell centre containing the city. Boxes are k x k cells around that centre, edges on cell edges:

| Box | Size | Role |
| --- | --- | --- |
| `box_1x1` | about 11 km | sensitivity |
| `box_3x3` | about 33 km | **headline** |
| `box_5x5` | about 55 km | sensitivity |
| 9 x 9 grid | about 100 km | exploratory trend map |

Douala's boxes are the original study design (`box_3x3` = 3.9 to 4.2 N, 9.6 to 9.9 E). Every other region
must be checked on a map (the centre cell contains the city, the 3 x 3 box is mostly land) before its
results are published; until then `verified` is false.

## 4. Processing rules

- Monthly total (mm) = rate (mm/hr) x 24 x days in that month (leap years counted). mm/day and mm/month
  are converted explicitly; an unknown unit stops the program.
- Box value = plain mean of the cells whose centres fall inside the box. A box with a missing cell fails
  loudly instead of shrinking.
- Annual total = sum of 12 monthly totals. A year with fewer than 12 months is excluded and listed.
  No gap filling.
- A complete year outside 300 to 12,000 mm raises a warning (almost always a unit error).

## 5. Statistics (alpha 0.05)

- **Lag-1 autocorrelation**; significant if |r1| > 1.96 / sqrt(n).
- **Mann-Kendall** (original) is always reported. The **Hamed-Rao modified** test is the primary test when
  lag-1 autocorrelation is significant.
- **Sen's slope** (mm per year) with its 95% confidence interval, always reported whatever the p-value.
- **Relative change** = slope x 10 / mean annual total x 100, in % per decade.
- **Pettitt** change-point test, to tell a single step from a gradual trend.
- **Sensitivity runs** (other boxes, GPCP) are robustness checks only.
- **Trend map:** 81 per-cell tests are exploratory. Always show the expected number of false positives
  (alpha x number of cells, about 4).
- At least 10 complete years are required.

## 6. Known threats the app must show, not hide

1. **Satellite change in 2014** (shown when the period spans 2014). IMERG is calibrated to TRMM until
   May 2014 and to GPM from June 2014. NASA warns that a changing satellite constellation can create
   artifacts in multi-year studies. A step in 2014 can look like a trend.
2. **Coastal location** (Douala, Buea). NASA reports lower IMERG skill over coastal zones.
3. **Short record.** About 24 annual values give low statistical power. A non-significant result is a
   valid, expected outcome.
4. **Area estimate.** A grid average is a satellite estimate over an area, not a station measurement.

## 7. Allowed and banned wording

| Allowed | Banned |
| --- | --- |
| "The satellite record shows a statistically significant increase / decrease" | "proves", "confirms climate change", any cause (climate change, deforestation, urbanisation, humans) |
| "No statistically significant trend was detected" | "Rainfall did not change", "rainfall is stable" |
| "Satellite estimate averaged over a 33 km box around Garoua" | "Measured in Garoua", "station data", "rain gauge" |
| "The estimated change is X mm per year (95% CI A to B)" | "Rainfall will increase / decrease", any forecast |
| "The change coincides with the 2014 satellite transition and may be an artifact" | Hiding or softening the 2014 caveat |

These rules are enforced in code for every AI text (`backend/app/services/ai/interpreter.py`).

## 8. Plain-language method (for the Method page)

**From rate to yearly total.** The monthly file stores an average rate, usually millimetres per hour.
Each month: total = rate x 24 hours x days in the month. The yearly total adds the 12 months. A year with
a missing month is left out and listed. We never fill gaps.

**Mann-Kendall test.** Asks whether later years tend to be higher (or lower) than earlier ones. It looks only
at the order of the values, so one very wet year cannot dominate it, and it does not assume a bell curve.

**Autocorrelation check.** If one year's total is linked to the next, the plain test becomes too confident.
Then the modified Mann-Kendall test (Hamed-Rao) corrects for it.

**Sen's slope.** The size of the change in millimetres per year: the median of the slopes between every pair
of years, with a 95% interval. Always shown, significant or not.

**Pettitt test.** Looks for one year where the series jumps to a new level, because a one-time step (for
example a satellite change) can look like a gradual trend.

**Significance level 0.05.** A result is called significant when the chance of seeing such a pattern by luck
alone, with no real trend, is below 5%.

The results describe the past record only. They do not explain why rainfall behaves as it does and say
nothing about future years.

## 9. What the AI does and does not do

- **It does** turn numbers the analysis already produced into plain sentences. A template written in code
  always produces a correct text. Optionally, Google Gemini rewrites three paragraphs to read more easily.
  The first sentence (verdict, slope and interval) is never rewritten.
- **It does not** compute, choose or interpret anything. It never sees the raw data and never decides the verdict.
- **Every text is checked by code before it is shown:** every number must exist in the analysis; banned
  claims are rejected; the wording must match the direction of the result; each caveat keeps its key words.
  If a Gemini rewrite fails any check, the template is shown instead, and the response says which one
  (`source`) and whether all checks passed.
