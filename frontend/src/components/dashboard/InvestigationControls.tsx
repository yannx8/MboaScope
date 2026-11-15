import { FIRST_YEAR, LAST_YEAR, MIN_YEARS, periodIsValid, useInvestigation } from '../../hooks/useInvestigation'
import { SENSOR_CHANGE_YEAR } from '../../services/format'

// One-click periods. The two satellite eras let the user test whether a result depends on the 2014 change.
export const PRESETS = [
  { label: 'Full record', start: FIRST_YEAR, end: LAST_YEAR, hint: 'Every complete year' },
  { label: 'TRMM era', start: FIRST_YEAR, end: SENSOR_CHANGE_YEAR - 1, hint: 'Before the 2014 satellite change' },
  { label: 'GPM era', start: SENSOR_CHANGE_YEAR, end: LAST_YEAR, hint: 'From the 2014 satellite change' },
].filter((p) => p.end - p.start + 1 >= MIN_YEARS)

const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)

/** Region and period pickers shared by every page. */
export function InvestigationControls() {
  const { regions, regionsError, request, setRequest } = useInvestigation()
  const valid = periodIsValid(request)
  const sorted = [...regions].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <form className="controls" onSubmit={(e) => e.preventDefault()} aria-label="Choose region and period">
      <label className="field field-region">
        <span>Region</span>
        <select value={request.region_id} onChange={(e) => setRequest({ region_id: e.target.value })}>
          {regions.length === 0 && <option value={request.region_id}>{regionsError ? 'Regions unavailable' : 'Loading regions…'}</option>}
          {regions.length > 0 && !regions.some((r) => r.id === request.region_id) && (
            <option value={request.region_id} disabled>
              Unknown region, choose one
            </option>
          )}
          {sorted.map((r) => (
            <option key={r.id} value={r.id} disabled={!r.has_data}>
              {r.name} ({r.admin_region}){r.has_data ? '' : ', no data yet'}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>From</span>
        <select value={request.start_year} aria-invalid={!valid} onChange={(e) => setRequest({ start_year: Number(e.target.value) })}>
          {YEARS.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>To</span>
        <select value={request.end_year} aria-invalid={!valid} onChange={(e) => setRequest({ end_year: Number(e.target.value) })}>
          {YEARS.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <div className="presets" role="group" aria-label="Quick periods">
        {PRESETS.map((p) => {
          const active = request.start_year === p.start && request.end_year === p.end
          return (
            <button
              key={p.label}
              type="button"
              className="preset"
              aria-pressed={active}
              title={`${p.hint}: ${p.start} to ${p.end}`}
              onClick={() => setRequest({ start_year: p.start, end_year: p.end })}
            >
              {p.label} <span>{p.start} to {p.end}</span>
            </button>
          )
        })}
      </div>
      {!valid && (
        <p className="controls-hint" role="alert">
          Choose at least {MIN_YEARS} years.
        </p>
      )}
    </form>
  )
}
