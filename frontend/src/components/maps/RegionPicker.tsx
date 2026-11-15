import { useEffect, useState, type KeyboardEvent } from 'react'
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import { useApi } from '../../hooks/useApi'
import { useInvestigation } from '../../hooks/useInvestigation'
import { api } from '../../services/api'
import { VERDICT_SHORT, VERDICT_TONE } from '../../services/format'
import type { Region, Verdict } from '../../types/api'
import { CAMEROON_OUTLINE } from '../common/Globe'
import { loadAdminBoundaries } from './adminBoundaries'

// Cameroon in a simple equirectangular projection (works offline, no tiles).
const LON_MIN = 8.2
const LON_MAX = 16.4
const LAT_MIN = 1.5
const LAT_MAX = 13.3
const K = 42 // pixels per degree of latitude
const COS = Math.cos((7.4 * Math.PI) / 180)
const PAD = 14
const W = (LON_MAX - LON_MIN) * K * COS + PAD * 2
const H = (LAT_MAX - LAT_MIN) * K + PAD * 2

const px = (lon: number) => PAD + (lon - LON_MIN) * K * COS
const py = (lat: number) => PAD + (LAT_MAX - lat) * K

// Labels go left of the dot where two capitals sit close together.
const LABEL_LEFT = new Set(['buea', 'bamenda'])

const ring = (points: Position[]) =>
  points.map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join('') + 'Z'

function geometryPath(g: Geometry): string {
  if (g.type === 'Polygon') return g.coordinates.map(ring).join('')
  if (g.type === 'MultiPolygon') return g.coordinates.flatMap((poly) => poly.map(ring)).join('')
  return ''
}

/** Map of the study regions. Select a city to run the investigation there. */
export function RegionPicker() {
  const { regions, request, setRequest } = useInvestigation()
  const [admin, setAdmin] = useState<FeatureCollection | null>(null)
  useEffect(() => {
    let live = true
    loadAdminBoundaries().then((fc) => live && setAdmin(fc))
    return () => {
      live = false
    }
  }, [])

  // Same calls as the comparison table; the API client shares the answers.
  const withData = regions.filter((r) => r.has_data)
  const verdicts = useApi<Record<string, Verdict>>(
    async () => {
      const out: Record<string, Verdict> = {}
      await Promise.all(
        withData.map((r) =>
          api
            .trends({ region_id: r.id, start_year: request.start_year, end_year: request.end_year })
            .then((res) => {
              out[r.id] = res.headline.verdict
            })
            .catch(() => undefined),
        ),
      )
      return out
    },
    [withData.map((r) => r.id).join(','), request.start_year, request.end_year],
    withData.length > 0 && request.end_year - request.start_year + 1 >= 10,
  )

  const choose = (r: Region) => {
    if (r.has_data && r.id !== request.region_id) setRequest({ region_id: r.id })
  }
  const onKey = (e: KeyboardEvent, r: Region) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(r)
    }
  }

  return (
    <figure className="picker">
      <svg viewBox={`0 0 ${W.toFixed(0)} ${H.toFixed(0)}`} className="picker-map" role="group" aria-label="Map of the study regions of Cameroon">
        <defs>
          <filter id="p-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {admin ? (
          admin.features.map((f: Feature, i) => <path key={i} d={geometryPath(f.geometry)} className="picker-admin" />)
        ) : (
          <path d={ring(CAMEROON_OUTLINE)} className="picker-land" />
        )}
        {regions.map((r) => {
          const [lat, lon] = r.centre
          const x = px(lon)
          const y = py(lat)
          const current = r.id === request.region_id
          const verdict = verdicts.data?.[r.id]
          const tone = verdict ? VERDICT_TONE[verdict] : 'unknown'
          const left = LABEL_LEFT.has(r.id)
          const label = r.has_data
            ? `${r.name}, ${r.admin_region} region${verdict ? `: ${VERDICT_SHORT[verdict]}` : ''}`
            : `${r.name}: no data yet`
          return (
            <g
              key={r.id}
              className={`pin pin-${tone}${current ? ' pin-current' : ''}${r.has_data ? '' : ' pin-empty'}`}
              transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
              role="button"
              tabIndex={r.has_data ? 0 : -1}
              aria-label={label}
              aria-pressed={current}
              aria-disabled={!r.has_data}
              onClick={() => choose(r)}
              onKeyDown={(e) => onKey(e, r)}
            >
              <title>{label}</title>
              <circle r={20} className="pin-hit" />
              {current && <circle r={16} className="pin-halo" filter="url(#p-glow)" />}
              <circle r={current ? 9 : 7} className="pin-ring" />
              <circle r={current ? 4.5 : 3.5} className="pin-dot" />
              <text x={left ? -13 : 13} y={4} textAnchor={left ? 'end' : 'start'} className="pin-label">
                {r.name}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="picker-key">
        <span><i className="sw-pin pin-wetter" /> Wetter</span>
        <span><i className="sw-pin pin-drier" /> Drier</span>
        <span><i className="sw-pin pin-neutral" /> No significant trend</span>
        <span><i className="sw-pin pin-current-key" /> Selected</span>
        {!admin && <span className="small">Outline simplified.</span>}
      </figcaption>
    </figure>
  )
}
