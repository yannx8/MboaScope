# MboaScope: two-developer plan

The project moved from a six-role static pipeline to the planned structure: a FastAPI backend with
SQLite, a React + TypeScript frontend, and ten study regions across Cameroon. This page says who owns
what, what is already done, and the remaining work, split between two developers.

**The one question the MVP answers:** has rainfall increased or decreased over time in a selected
region of Cameroon, and is that trend statistically significant?

## 1. Roles

| | Developer A: Data, Science & Backend | Developer B: Frontend & AI |
| --- | --- | --- |
| Stack | Python, FastAPI, SQLite, NASA Earthdata | React, TypeScript, Vite, Recharts, Leaflet, Gemini |
| Owns | `backend/` except `services/ai/` and `routes/assistant.py` and `schemas/ai.py`; `data/`; `tests/` except `test_ai_interpreter.py`; `Makefile`; `.github/workflows/ci.yml` | `frontend/`; `backend/app/services/ai/`; `backend/app/routes/assistant.py`; `backend/app/schemas/ai.py`; `tests/test_ai_interpreter.py`; `.github/workflows/pages.yml` |
| Branch prefix | `feature/a-<task>-<slug>` | `feature/b-<task>-<slug>` |
| Commit prefix | `data:`, `gis:`, `analytics:`, `api:` | `frontend:`, `ai:` |

Shared (change only together, in one pull request reviewed by both): the API contract, which is
`backend/app/schemas/*.py` **and** `frontend/src/types/api.ts` **and** `docs/api.md`. Also
`AGENTS.md`, `README.md`, this file.

Pick roles by strongest skill. A Python-first developer takes A; a frontend-first developer takes B.
The AI module is mostly finished, so it adds little load to B. If the AI engineer prefers to stay
on Python, move tasks B7 to B9 to Developer A and keep B on the frontend only.

## 2. What is already done (on branch `restructure/fastapi-react-mvp`)

- FastAPI backend with the five MVP endpoints, plus `GET /api/health` and `GET /api/analysis/history`.
- SQLite storage: observations, Giovanni box observations, data sources, investigation log.
- Ten study regions (one per regional capital), box geometry, per-cell extraction, annual totals.
- Statistics: Mann-Kendall, Hamed-Rao (bug fixed: it was running the original test), Sen's slope
  with 95% CI, Pettitt, lag-1 autocorrelation, sensitivity boxes, exploratory per-cell map.
- AI interpretation: checked template for any region, optional Gemini rewrite with fallback,
  suggested follow-up investigations.
- Deterministic mock data for all ten regions, so nobody waits for NASA.
- New frontend: Dashboard, Explorer, Analysis, Assistant pages, wired to the real API.
- 246 tests passing (`python -m pytest -q`), frontend type-checks and builds.

What is **not** done: no real NASA data yet (everything is mock), nine of ten region boxes are not
checked on a map, the frontend is functional but not designed, nothing is deployed.

## 3. Remaining work

Each task is one GitHub issue. "Done" = merged on `main`, tests green, the check in the last column passes.

### Developer A: Data, Science & Backend

| # | Task | Files | Done when |
| --- | --- | --- | --- |
| A1 | **Real data spike.** Run `python -m app.cli inspect-granule` on one granule. Confirm group `Grid`, variable `precipitation`, dimension order, `units` attribute, fill value, and the last available month (V07 stops during 2025, so `END_YEAR = 2024`; done). Fix `fetch_imerg.py` if anything differs. | `services/nasa/inspect_granule.py`, `fetch_imerg.py`, `core/config.py` | Printed structure pasted in the issue |
| A2 | **Full fetch, all ten regions.** `python -m app.cli fetch-imerg --limit 3` first, then the full run. Plan B if Earthdata fails for more than half a day: one Giovanni CSV per region with `import-giovanni --activate`. | `services/nasa/fetch_imerg.py` | `python -m app.cli status` shows `earthaccess` for all regions |
| A3 | **Check every study box on a map.** Each centre cell must contain the city and the 3 x 3 box should be mostly land. Set `verified: true` per region; move a centre by one cell if needed. Add `data/regions/cameroon_admin1.geojson` (10 regions, simplified, with source and licence noted) for B's map. | `data/regions/` | All ten `verified: true`; GeoJSON committed (< 500 kB) |
| A4 | **Cross-check against Giovanni.** For Douala, compare one month of the 3 x 3 box mean with Giovanni's area average. | `tests/test_nasa_crosscheck.py` (skips if the CSV is absent) | Difference < 1%, numbers in the issue |
| A5 | **Ship the data with the repo.** The SQLite file is gitignored. Add `python -m app.cli export` (observations + sources to `data/processed/observations.csv.gz`) and `python -m app.cli load` (rebuild the database from it). The server loads it on start-up if the database is empty. | `cli.py`, `models/database.py`, `main.py` | Fresh clone + `load` gives the same `/api/analysis/trends` answer |
| A6 | **Validate the statistics.** Run `backend/scripts/check_mann_kendall.py` for every region on real data. Add a test comparing Hamed-Rao against a published or hand-computed reference value. | `services/analytics/`, `tests/test_analytics_*.py` | MATCH for all regions; new test green |
| A7 | **Results note for B.** One short paragraph per region: verdict, slope, CI, Pettitt year, anything surprising. B uses it to check the AI text and to write the demo. | issue comment | Posted after A2 |
| A8 | *Should:* GPCP V3.3 as a sensitivity row (different product, never joined to IMERG). | `services/nasa/fetch_gpcp.py`, `services/analytics/trends.py` | GPCP row appears in `sensitivity` |
| A9 | **Deploy the backend** (Render or Railway free tier). Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` from `backend/`. Set `CORS_ORIGINS` to the frontend URL, `GEMINI_API_KEY` as a secret. | `render.yaml` or equivalent, `README.md` | Public `/api/health` returns `is_mock: false` |

### Developer B: Frontend & AI

| # | Task | Files | Done when |
| --- | --- | --- | --- |
| B1 | **Run the app locally on mock data** and read every page. List what is wrong or missing in the issue. | none | Issue with the list |
| B2 | **Design rebuild.** Keep the four pages and the data flow; redesign the look. Mobile first (test at 360 px), one consistent type scale, colour meaning fixed (brown drier, blue wetter, purple 2014), dark mode optional. Use `frontend/src/styles.css` as the starting point or replace it. | `frontend/src/**` | Screenshots at 360 px and 1280 px in the pull request |
| B3 | **Dashboard: compare regions.** A small table or map of all ten regions with their verdict (call `/api/analysis/trends` per region, or ask A for a batch endpoint through a contract issue). | `pages/Dashboard.tsx`, `components/dashboard/` | All regions visible with verdict and slope |
| B4 | **Explorer: real map.** Draw the Cameroon outline and regions from A3's GeoJSON, a colour legend for the per-cell slopes, and a clearer headline-box outline. | `components/maps/`, `pages/Explorer.tsx` | Map readable without tiles (tiles can fail offline) |
| B5 | **Accessibility and states.** Every chart has a text alternative and a data table; keyboard navigation works; loading, empty, error and "no data for this region" states are designed. | `components/**` | Lighthouse accessibility score >= 90 |
| B6 | **Method page.** A fifth page that renders the plain-language method (`docs/methodology.md`, sections "Plain-language method" and "What the AI does"). | `pages/Method.tsx` | Linked from the footer and nav |
| B7 | **AI on real data.** Run `python -m app.services.ai.interpreter --eval --llm` (add 3-limitation inland cases to the fixtures). Check the Gemini text for each region against A7's note. Update `docs/ai-eval.md`. | `services/ai/`, `tests/fixtures/`, `tests/test_ai_interpreter.py` | All eval cases pass checks; eval table updated |
| B8 | **Cache Gemini answers.** Store accepted rewrites in SQLite keyed by region, period and a hash of the analysis, so a page view never waits for Gemini twice. Add the table through a short PR reviewed by A. | `services/ai/`, `models/database.py` (with A) | Second call returns instantly with `source: gemini` |
| B9 | *Should:* free-text question box in the Assistant. The model may only answer from the analysis JSON, and its answer passes the same number, claim and direction checks; otherwise show "I can only answer from the computed results." | `services/ai/`, `routes/assistant.py`, `schemas/ai.py`, `pages/Assistant.tsx` | Six adversarial questions in tests are refused or answered within the checks |
| B10 | **Frontend tests and bundle.** Vitest + Testing Library for the API client and two pages; split Recharts and Leaflet into their own chunks. | `frontend/` | `npm test` green in CI; main chunk < 300 kB |
| B11 | **Deploy the frontend** (Vercel, Netlify or GitHub Pages) with `VITE_API_URL` set to A9's backend. | `.github/workflows/pages.yml` or host config | Public URL works from a phone |
| B12 | **Two outsider tests.** Watch two people who have never seen the app answer "Is it getting wetter in Garoua?" Fix what confuses them. | any | Notes in the issue |

## 4. Order and hand-offs

```
A1 -> A2 -> A7 ------------------> B7 (AI text checked on real numbers)
       |-> A3 (GeoJSON) --------> B4 (map)
       |-> A5 -> A9 (backend) --> B11 (frontend deploy needs the API URL)
B1 -> B2 -> B3, B5, B6 (all on mock data, no waiting)
```

Nobody waits: the mock database has the same shape as the real one, so B builds everything on mock
data while A brings in NASA data. When A2 merges, B reloads and sees real numbers with no code change.

### Milestones

| Milestone | Contents | Definition of done |
| --- | --- | --- |
| M1: Real data | A1, A2, A3, B1, B2 started | `status` shows real data for all regions; B has a design draft |
| M2: Trustworthy results | A4, A5, A6, A7, B2, B3, B5 | Statistics validated; redesigned pages on real data |
| M3: Complete product | A9, B4, B6, B7, B8, B11 | Both halves deployed; AI checked on real results |
| M4: Polish | A8, B9, B10, B12 | Optional items, outsider tests fixed |

The first concrete milestone is a complete rainfall investigation on real NASA data. Everything else
is secondary until that works.

## 5. How we work

- One repository, `main` protected, one branch per task, pull request reviewed by the other developer.
- Rebase on `origin/main`, run `python -m pytest -q` (and `npm run build` in `frontend/` for B), then
  open the pull request with `Closes #<n>`.
- Contract changes (a field added, renamed or removed in any response) touch the three contract files
  in one pull request and need both developers' approval.
- Short daily check-in (10 minutes): done, next, blocked. Blocked for more than 45 minutes: say so.
- Secrets live only in `.env` (gitignored). Never commit keys or passwords.

## 6. Out of scope for the MVP

Forecasting, other climate variables, machine-learning models, user accounts, a production database,
several NASA products joined into one series, anomaly detection.
