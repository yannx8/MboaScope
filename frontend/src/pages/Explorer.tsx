import { useState } from 'react'
import { Term } from '../components/common/Term'
import { Card } from '../components/common/Card'
import { DataTable } from '../components/common/DataTable'
import { ApiProblem, Loading, PeriodProblem } from '../components/common/Status'
import { hasAdminBoundaries } from '../components/maps/adminBoundaries'
import { RegionMap } from '../components/maps/RegionMap'
import { useApi } from '../hooks/useApi'
import { periodIsValid, useInvestigation } from '../hooks/useInvestigation'
import { api } from '../services/api'
import { num, pValue, signed } from '../services/format'

export default function Explorer() {
  const { regions, region, request, setRequest } = useInvestigation()
  const valid = periodIsValid(request)
  const ok = valid && !!region?.has_data
  const spatial = useApi(() => api.spatial(request), [request.region_id, request.start_year, request.end_year], ok)
  const [view, setView] = useState<'region' | 'country'>('region')
  const [tiles, setTiles] = useState(true)
  const [tilesFailed, setTilesFailed] = useState(false)
  const s = spatial.data
  const cells = s?.available ? s.cells : []
  // Only stretches the colour scale; not a statistic.
  const scale = Math.max(0, ...cells.map((c) => Math.abs(c.sen_slope_mm_per_year)))

  if (!valid) return <PeriodProblem />

  return (
    <div className="grid">
      <div className="span-8">
        <Card
          title={region ? `${region.name}: study area` : 'Study regions'}
          subtitle="Each square is one satellite cell of about 11 km. The thick outline is the 33 km headline box."
        >
          <div className="map-toolbar">
            <div role="group" aria-label="Map view" style={{ display: 'flex', gap: '0.4rem' }}>
              <button type="button" className={`btn btn-small ${view === 'region' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={view === 'region'} onClick={() => setView('region')}>
                Zoom to {region?.name ?? 'region'}
              </button>
              <button type="button" className={`btn btn-small ${view === 'country' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={view === 'country'} onClick={() => setView('country')}>
                Whole country
              </button>
            </div>
            <label className="switch">
              <input type="checkbox" checked={tiles && !tilesFailed} disabled={tilesFailed} onChange={(e) => setTiles(e.target.checked)} />
              Street map background
            </label>
          </div>
          <RegionMap
            regions={regions}
            selected={region}
            spatial={s}
            scale={scale}
            view={view}
            showTiles={tiles && !tilesFailed}
            onTileError={() => setTilesFailed(true)}
            onSelect={(id) => setRequest({ region_id: id })}
          />
          {tilesFailed && (
            <p className="small" role="status" style={{ marginTop: '0.5rem' }}>
              The street map could not load (offline?). The study data is drawn without it.
            </p>
          )}
          {!hasAdminBoundaries && (
            <p className="small" style={{ marginTop: '0.5rem' }}>
              Country and region borders appear here once the boundary file is added (task A3).
            </p>
          )}
        </Card>
      </div>

      <div className="span-4 stack">
        <Card title="Per-cell trends" subtitle="Exploratory: 81 separate tests on the 9 x 9 grid.">
          {region && !region.has_data && <ApiProblem status={409} message="" />}
          {spatial.error && <ApiProblem status={spatial.status} message={spatial.error} onRetry={spatial.reload} />}
          {spatial.loading && <Loading label="Testing every cell…" />}
          {s && !s.available && <p>Per-cell values are not available for this region: only area-averaged data was loaded.</p>}
          {s && s.available && (
            <>
              <p>
                <span className="big-number">{s.n_significant}</span> of {s.n_cells} cells show a trend with p below {s.alpha}.
              </p>
              <p className="callout">
                With no real trend at all, about <strong>{s.expected_false_positives}</strong> cells would pass that threshold by
                chance. Look at the overall pattern, not at single cells. The headline answer uses the 33 km box only.
              </p>
              <div className="legend-scale" aria-label="Colour scale for the Sen slope of each cell">
                <div className="legend-bar" aria-hidden="true" />
                <div className="legend-ticks">
                  <span>{signed(-scale)}</span>
                  <span>0</span>
                  <span>{signed(scale)}</span>
                </div>
                <p className="small" style={{ margin: '0.15rem 0 0' }}>
                  <Term id="sen_slope">Sen slope</Term>, mm per year. Brown: drier. Blue: wetter.
                </p>
              </div>
              <ul className="legend-list">
                <li><span className="sw sw-box" aria-hidden="true" /> Headline box (33 km)</li>
                <li><span className="sw sw-sig" aria-hidden="true" /> Outlined cell: p below {s.alpha}</li>
                <li><span className="sw-dot" aria-hidden="true" /> Regional capital (click to choose)</li>
              </ul>
              <DataTable
                summary={`Show all ${s.n_cells} cells`}
                caption="Per-cell Sen slope and p-value, north to south"
                head={
                  <tr>
                    <th scope="col">Cell centre</th>
                    <th scope="col" className="num">mm/yr</th>
                    <th scope="col" className="num">p</th>
                    <th scope="col" className="num">Mean mm</th>
                  </tr>
                }
                rows={[...s.cells]
                  .sort((a, b) => b.lat - a.lat || a.lon - b.lon)
                  .map((c) => (
                    <tr key={`${c.lat},${c.lon}`}>
                      <th scope="row" className="nowrap">
                        {c.lat.toFixed(2)}, {c.lon.toFixed(2)}
                      </th>
                      <td className="num">{signed(c.sen_slope_mm_per_year)}</td>
                      <td className="num">{pValue(c.p)}</td>
                      <td className="num">{num(c.mean_annual_mm)}</td>
                    </tr>
                  ))}
              />
            </>
          )}
        </Card>
        {region && (
          <Card title="About this region">
            <dl className="facts" style={{ marginTop: 0 }}>
              <dt>Region</dt>
              <dd>
                {region.name}, {region.admin_region}
              </dd>
              <dt>Centre cell</dt>
              <dd>
                {region.centre[0]}° N, {region.centre[1]}° E
              </dd>
              <dt>Coastal</dt>
              <dd>{region.coastal ? 'Yes: lower satellite accuracy' : 'No'}</dd>
              <dt>Box checked on a map</dt>
              <dd>{region.verified ? 'Yes' : 'Not yet (provisional)'}</dd>
              <dt>Data</dt>
              <dd>{region.has_data ? `${region.access_method}, ${region.period?.join(' to ')}` : 'not loaded'}</dd>
            </dl>
          </Card>
        )}
      </div>
    </div>
  )
}
