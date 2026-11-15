# Architecture

A modular monolith: one FastAPI process, one SQLite file, one React app. Modules talk through plain
Python function calls inside the backend and through the HTTP contract (`docs/api.md`) with the frontend.

```
 USER  selects region, period, investigation
   |
   v
 REACT FRONTEND (frontend/)                                   Developer B
   Dashboard · Explorer (map) · Analysis (charts) · Assistant (AI)
   services/api.ts is the only module that calls the backend
   |  HTTP JSON (docs/api.md)
   v
 FASTAPI BACKEND (backend/app/)                               Developer A
   routes/       health · regions · rainfall · analysis · assistant(B)
   schemas/      Pydantic models = the API contract
   services/investigation.py   region + period -> NASA -> GIS -> analytics, cached
   |
   +--> services/nasa/       fetch IMERG, Giovanni import, mock, units      (A)
   +--> services/gis/        study regions, boxes, extraction, annual totals (A)
   +--> services/analytics/  Mann-Kendall, Hamed-Rao, Sen, Pettitt, map     (A)
   +--> services/ai/         template, checks, Gemini rewrite, suggestions   (B)
   |
   v
 SQLITE (data/processed/mboascope.db)
   observations · box_observations · sources · investigations
```

## Request flow: `POST /api/analysis/trends {"region_id": "garoua", "start_year": 2001, "end_year": 2024}`

1. `routes/analysis.py` validates the body (Pydantic) and calls `investigation.run()`.
2. `investigation.run()` checks the region exists, that data was ingested, and the period (>= 10 years,
   inside the available months). The result is cached per region, period and data version.
3. `nasa/precipitation.py` reads the `sources` row. Its `access_method` decides the input:
   per-cell `observations` (mock, earthaccess) or Giovanni `box_observations` (plan B). Rates are
   converted to monthly totals in mm.
4. `gis/spatial.py` builds annual totals for each box and each cell, marking incomplete years.
5. `analytics/trends.py` runs the tests on the headline box, the sensitivity boxes and the 81 cells,
   and rounds for display.
6. The route logs the investigation and returns the `TrendsResponse`.

`/api/ai/interpret` reuses the same cached investigation and passes the headline to
`ai/interpreter.py`, which never sees raw data.

## Data ingestion (offline, command line)

```
python -m app.cli seed-mock                         # synthetic, all regions (is_mock: true)
python -m app.cli inspect-granule                   # spike on one real granule
python -m app.cli fetch-imerg [--region garoua]     # plan A: per-cell, all regions
python -m app.cli import-giovanni f.csv --region douala --activate   # plan B
python -m app.cli status
```

Ingestion writes rates exactly as NASA stores them, plus a `sources` row. Nothing downstream changes
when mock data is replaced by real data.

## Design decisions

- **SQLite, not a server database.** A few hundred thousand rows; one file; zero setup. Replaceable later
  behind `models/database.py`.
- **Compute on request, cache in memory.** A full investigation takes about 0.4 s; caching makes page
  switches instant. No precomputed result files to keep in sync.
- **The backend rounds, the frontend displays.** One place decides what a number looks like, and the AI
  checks compare against exactly those numbers.
- **AI is downstream of statistics.** It words results, it never produces them, and every sentence is
  checked in code.
- **Mock data has the real shape.** The frontend and AI are built and tested before NASA data exists.
