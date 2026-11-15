import { useApi } from '../../hooks/useApi'
import { useInvestigation } from '../../hooks/useInvestigation'
import { api } from '../../services/api'
import { primaryP, pValue, signed } from '../../services/format'
import type { Region, TrendsResponse } from '../../types/api'
import { Loading } from '../common/Status'
import { VerdictChip } from '../common/VerdictChip'

type Row = { region: Region; result: TrendsResponse | null; error: string | null }

/**
 * All study regions for the same period (task B3). One /api/analysis/trends call per region;
 * answers are cached for the session, so revisiting is instant.
 * Ordered north to south so the table reads like the map.
 */
export function RegionComparison() {
  const { regions, request, setRequest } = useInvestigation()
  const withData = regions.filter((r) => r.has_data)
  const ids = withData.map((r) => r.id).join(',')
  const state = useApi<Row[]>(
    () =>
      Promise.all(
        withData.map((region) =>
          api
            .trends({ region_id: region.id, start_year: request.start_year, end_year: request.end_year })
            .then((result) => ({ region, result, error: null }))
            .catch((err: Error) => ({ region, result: null, error: err.message })),
        ),
      ),
    [ids, request.start_year, request.end_year],
    withData.length > 0,
  )

  const missing = regions.filter((r) => !r.has_data)
  if (state.loading) return <Loading label={`Running the tests for ${withData.length} regions…`} />
  if (!state.data) return null
  const rows = [...state.data].sort((a, b) => b.region.centre[0] - a.region.centre[0])

  return (
    <>
      <div className="table-scroll" style={{ maxHeight: 'none' }} tabIndex={0} role="region" aria-label="Trend results for every region">
        <table className="table">
          <caption className="sr-only">
            Trend test results for each study region, {request.start_year} to {request.end_year}, north to south
          </caption>
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Result</th>
              <th scope="col" className="num">Change (mm/yr)</th>
              <th scope="col" className="num hide-sm">95% interval</th>
              <th scope="col" className="num hide-sm">p</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ region, result, error }) => {
              const h = result?.headline
              const current = region.id === request.region_id
              return (
                <tr key={region.id} className={`compare-row${current ? ' current' : ''}`} aria-current={current ? 'true' : undefined}>
                  <th scope="row">
                    <button type="button" onClick={() => setRequest({ region_id: region.id })}>
                      {region.name}
                    </button>
                    <span className="sub">
                      {region.admin_region}
                      {!region.verified && ', provisional box'}
                    </span>
                  </th>
                  <td>{h ? <VerdictChip verdict={h.verdict} /> : <span className="small">{error}</span>}</td>
                  <td className="num">{h ? signed(h.sen_slope_mm_per_year) : '–'}</td>
                  <td className="num hide-sm nowrap">{h ? `${signed(h.sen_ci95[0])} to ${signed(h.sen_ci95[1])}` : '–'}</td>
                  <td className="num hide-sm">{h ? pValue(primaryP(h)) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="small" style={{ marginTop: '0.6rem' }}>
        Each row is its own test on its own 33 km box. Every test has a 5% chance of a false alarm, so across ten regions one
        "significant" row by chance alone would not be surprising. Slopes are in mm per year, so wet southern regions show larger numbers than dry northern ones.
        {missing.length > 0 && ` No data yet: ${missing.map((r) => r.name).join(', ')}.`}
      </p>
    </>
  )
}
