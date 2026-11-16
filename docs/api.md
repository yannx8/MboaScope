# API contract v2.0

The frontend and the backend communicate only through these endpoints. The source of truth is the
Pydantic models in `backend/app/schemas/`; `frontend/src/types/api.ts` mirrors them. A change to a
field touches both files and this page in one pull request, approved by both developers.

Interactive docs while the server runs: http://127.0.0.1:8000/docs

## Conventions

- Every POST body is an **investigation**: `{"region_id": "douala", "start_year": 2001, "end_year": 2025}`.
  Years default to 2001 and 2024 (IMERG V07 Final has no complete year after 2024). The period must be at least 10 years.
- Every response from a POST carries `api_version`, `generated_at` (UTC ISO 8601) and `is_mock`.
  `is_mock` is true when the region's data is synthetic; the frontend must then show the demo banner.
- The backend rounds for display: millimetres 0 decimals, slopes 1 decimal, p-values 3 decimals,
  percentages 1 decimal, correlations 2 decimals. The frontend never recomputes statistics.
- Bounds are always `[south, north, west, east]`.
- Errors return `{"detail": "..."}` with: 404 unknown region, 409 region has no data yet,
  422 invalid period or fewer than 10 complete years.

## Endpoints

| Method and path | Purpose | Owner |
| --- | --- | --- |
| `GET /api/health` | Server status and which regions have data | A |
| `GET /api/regions` | The ten study regions, their boxes and data availability | A |
| `POST /api/rainfall/series` | Annual totals of the headline box, seasonal cycle, provenance | A |
| `POST /api/analysis/trends` | Headline trend tests and robustness rows; logs the investigation | A |
| `POST /api/analysis/spatial` | Exploratory per-cell trends on the 9 x 9 grid | A |
| `GET /api/analysis/history?limit=20` | Recent investigations | A |
| `POST /api/ai/interpret` | Checked plain-language explanation and suggested next investigations | B |
| `POST /api/ai/ask` | Checked answer to one free-text question about the current result | B |

### `GET /api/regions`

```json
{"regions": [{
  "id": "douala", "name": "Douala", "admin_region": "Littoral",
  "centre": [4.05, 9.75], "coastal": true, "verified": true,
  "boxes": {"box_3x3": {"label": "Douala, 3 x 3 cells (about 33 km)", "bounds": [3.9, 4.2, 9.6, 9.9]}},
  "grid_bounds": [3.6, 4.5, 9.3, 10.2],
  "has_data": true, "access_method": "mock", "period": ["2001-01", "2025-12"]}]}
```

`verified` is false until the box has been checked on a map (task A3).

### `POST /api/rainfall/series`

```json
{"api_version": "2.0", "generated_at": "...", "is_mock": true,
 "region_id": "douala", "region_name": "Douala", "box": "box_3x3",
 "box_label": "Douala, 3 x 3 cells (about 33 km)", "bounds": [3.9, 4.2, 9.6, 9.9],
 "period": [2001, 2025],
 "years": [{"year": 2001, "total_mm": 3812, "months_present": 12, "complete": true}],
 "excluded_years": [],
 "climatology": [{"month": 1, "mean_mm": 86}],
 "warnings": [],
 "provenance": {"dataset": "GPM IMERG Final ...", "short_name": "GPM_3IMERGM", "version": "07",
   "doi": "10.5067/GPM/IMERG/3B-MONTH/07", "access_method": "mock", "source_units": "mm/hr",
   "period": ["2001-01", "2025-12"], "granule_count": 300, "notes": ["..."]}}
```

Incomplete years appear with `complete: false` and are listed in `excluded_years`; they are never
filled. `warnings` lists implausible annual totals (usually a unit error).

### `POST /api/analysis/trends`

```json
{"api_version": "2.0", "generated_at": "...", "is_mock": true, "investigation_id": 12,
 "headline": {"region_id": "douala", "region_name": "Douala", "box": "box_3x3", "dataset": "IMERG V07",
   "period": "2001-2025", "n_years": 25, "alpha": 0.05, "mean_annual_mm": 3700,
   "lag1_autocorr": 0.12, "autocorr_significant": false, "mk_test_used": "original",
   "mk_original": {"tau": 0.08, "z": 0.54, "p": 0.589, "trend": "no trend"},
   "mk_hamed_rao": {"z": 0.51, "p": 0.610, "trend": "no trend"},
   "sen_slope_mm_per_year": 4.2, "sen_intercept_mm": 3650, "sen_ci95": [-11.3, 19.8],
   "pct_per_decade": 1.1,
   "pettitt": {"change_year": 2014, "k": 64, "p": 0.210, "significant": false},
   "verdict": "no_significant_trend",
   "caveats": ["sensor_change_2014", "coastal_skill", "short_record", "area_estimate"]},
 "sensitivity": [{"box": "box_1x1", "dataset": "IMERG V07", "n_years": 25, "p": 0.500,
   "sen_slope_mm_per_year": 3.9, "sen_ci95": [-15.0, 22.1], "verdict": "no_significant_trend"}]}
```

- `verdict` is one of `significant_increase`, `significant_decrease`, `no_significant_trend`.
- The primary p-value is `mk_hamed_rao.p` when `mk_test_used` is `hamed_rao`, else `mk_original.p`.
- The chart draws the Sen line as `sen_intercept_mm + sen_slope_mm_per_year x (year - first year)`.
- `pettitt.change_year` is the first year of the new regime.
- `caveats` depends on region and period: `sensor_change_2014` only if the period spans 2014,
  `coastal_skill` only for coastal regions.
- `sensitivity` is empty under plan B (Giovanni box data).

### `POST /api/analysis/spatial`

```json
{"api_version": "2.0", "generated_at": "...", "is_mock": true, "region_id": "douala",
 "grid_bounds": [3.6, 4.5, 9.3, 10.2], "exploratory": true, "available": true,
 "n_cells": 81, "alpha": 0.05, "expected_false_positives": 4.05, "n_significant": 3,
 "cells": [{"lat": 4.05, "lon": 9.75, "mean_annual_mm": 3700, "sen_slope_mm_per_year": 4.2, "p": 0.589}]}
```

Under plan B: `"available": false`, `"cells": []`. Always show `expected_false_positives` next to the map.

### `POST /api/ai/interpret`

Body: the investigation plus `"use_llm": false | true`.

```json
{"api_version": "2.0", "generated_at": "...", "is_mock": true, "region_id": "douala",
 "explanation": {"source": "template", "model": null, "checks_passed": true,
   "summary": "...", "what_it_means": "...", "what_it_does_not_mean": "...",
   "limitations": ["one sentence per caveat code, same order"]},
 "notes": [],
 "suggestions": [{"title": "Repeat the test on the GPM era only", "reason": "...",
   "region_id": "douala", "start_year": 2014, "end_year": 2025}]}
```

- `source` is `gemini` only when the rewrite passed every check; otherwise the template is returned
  and `notes` says why.
- If `checks_passed` is false the frontend must hide the text.
- A suggestion with `region_id: null` means "let the user pick a region".
- With `use_llm`, a rewrite that passed every check is cached in SQLite (region, period, hash of the
  analysis), so the second request returns it at once. Stored texts are checked again on every read.

### `POST /api/ai/ask`

Body: the investigation plus `"question"` (2 to 300 characters) and `"use_llm": false | true`.
Never cached by the frontend.

```json
{"api_version": "2.0", "generated_at": "...", "is_mock": true, "region_id": "garoua",
 "question": "Is it getting wetter?",
 "answer": {"source": "rules", "model": null, "answered": true, "text": "..."},
 "notes": []}
```

- `source` is `gemini` when the model answer passed the number, claim, direction and length checks,
  `rules` when a fixed answer was built from the analysis, `refusal` otherwise.
- A refusal always has `answered: false` and the text "I can only answer from the computed results."
- Questions outside the analysis (temperature, floods, weather) are refused without calling a model.
  A question naming another region gets a pointer to the region menu.
- `notes` says why Gemini or a rule was not used. A question that is too short or too long returns 422.

## Storage (backend internal, not part of the contract)

SQLite at `data/processed/mboascope.db` (path from `MBOASCOPE_DB`). Tables: `observations`
(per-cell monthly rates as stored by NASA), `box_observations` (Giovanni area averages),
`sources` (one row per region; `access_method` is the only switch between plan A and plan B),
`investigations` (log). See `backend/app/models/database.py`.
