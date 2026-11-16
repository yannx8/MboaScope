import { useEffect, useState } from 'react'
import type { Region } from '../../types/api'

// Decorative globe centred on Cameroon (orthographic projection).
// The coastline and the Cameroon outline are coarse hand-drawn shapes for decoration only.
// The dots are the real study-box centres returned by GET /api/regions.

const C = 300 // centre of the 600 x 600 viewBox
const R = 225 // globe radius

type LonLat = [number, number]

const AFRICA: LonLat[] = [
  [-17, 21], [-16, 24], [-13, 28], [-9, 32], [-6, 35.8], [0, 35.8], [10, 37], [11, 33], [20, 31], [25, 31.5],
  [32, 31.2], [34, 28], [35, 24], [37, 20], [39, 15], [43, 12], [51, 11.8], [49, 7], [44, 1.5], [40, -3],
  [39.5, -7], [40.5, -11], [40, -16], [35, -21], [35.5, -24], [32.5, -28.5], [28, -33], [20, -34.8], [18, -32],
  [15, -26], [12, -17], [13.5, -11], [12, -5], [9, -1], [9.5, 3], [8.5, 4.5], [6, 4.3], [2, 6.3], [-3, 5],
  [-7.5, 4.4], [-11, 6.9], [-13, 8.5], [-15, 11], [-17, 14.7], [-16.5, 19.5],
]
const ARABIA: LonLat[] = [[34.5, 28], [36, 32], [47, 30], [51, 26], [56, 26.5], [59.5, 22.5], [52, 16.5], [43.5, 12.7], [39, 21], [34.5, 28]]
const EUROPE: LonLat[] = [
  [-9, 37], [-9, 43.5], [-1.5, 43.5], [-4.5, 48.5], [2, 51], [8, 54], [10, 57.5], [12, 54.5], [21, 55], [28, 60],
  [30, 50], [36, 47], [28, 41], [26, 38], [23, 36.5], [20, 40], [16, 38], [12, 44.5], [8, 44], [3, 43], [-2, 36.8], [-9, 37],
]
export const CAMEROON_OUTLINE: LonLat[] = [
  [8.5, 4.6], [9.6, 3.8], [9.8, 2.3], [11.3, 2.2], [13.3, 2.2], [15, 2], [16.2, 2.2], [16, 3.5], [15.1, 4.3],
  [14.6, 5.4], [14.5, 6.2], [15.3, 7.5], [14.9, 8.8], [15.6, 9.9], [14, 10], [15.1, 10.9], [14.9, 12.1],
  [14.2, 13], [14, 12.5], [13.6, 11], [12.8, 8.7], [12.2, 8.2], [11.8, 7], [11, 6.5], [10.6, 7], [9.6, 6.5], [8.8, 5.6],
]

interface Point {
  x: number
  y: number
  z: number // > 0 when on the visible side
}

function project(lon: number, lat: number, lon0: number, lat0: number): Point {
  const d = Math.PI / 180
  const phi = lat * d
  const lam = (lon - lon0) * d
  const phi0 = lat0 * d
  return {
    x: C + R * Math.cos(phi) * Math.sin(lam),
    y: C - R * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam)),
    z: Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam),
  }
}

function linePath(points: LonLat[], lon0: number, lat0: number, closed = false): string {
  let d = ''
  let pen = false
  for (const [lon, lat] of points) {
    const p = project(lon, lat, lon0, lat0)
    if (p.z < 0) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    pen = true
  }
  return closed && d ? `${d}Z` : d
}

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)
const MERIDIANS = range(-180, 160, 20).map((lon) => range(-80, 80, 4).map((lat): LonLat => [lon, lat]))
const PARALLELS = range(-60, 60, 20).map((lat) => range(-180, 180, 4).map((lon): LonLat => [lon, lat]))

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

function useClock(): number {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (reducedMotion()) return
    let frame = 0
    let last = 0
    const start = performance.now()
    const tick = (now: number) => {
      if (now - last > 33) {
        last = now
        setT((now - start) / 1000)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return t
}

const ORBITS = [
  { rx: 285, ry: 70, tilt: -22, speed: 0.35, offset: 0 },
  { rx: 270, ry: 105, tilt: 28, speed: -0.25, offset: 2 },
]

export function Globe({
  regions,
  currentId,
  onSelect,
}: {
  regions: Region[]
  currentId: string
  onSelect?: (id: string) => void
}) {
  const t = useClock()
  const lon0 = 13 + 24 * Math.sin(t * 0.11)
  const lat0 = 7 + 5 * Math.sin(t * 0.07)

  const dots = regions
    .map((r) => ({ r, p: project(r.centre[1], r.centre[0], lon0, lat0) }))
    .filter(({ p }) => p.z > 0)
  const hub = dots.find((d) => d.r.id === currentId)

  return (
    <svg className="globe" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="g-ocean" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#1f6a5c" />
          <stop offset="55%" stopColor="#0b3330" />
          <stop offset="100%" stopColor="#031210" />
        </radialGradient>
        <radialGradient id="g-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="82%" stopColor="#6fe0b4" stopOpacity="0" />
          <stop offset="90%" stopColor="#6fe0b4" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6fe0b4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="g-shade" cx="30%" cy="25%" r="85%">
          <stop offset="45%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
        <filter id="g-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="g-clip">
          <circle cx={C} cy={C} r={R} />
        </clipPath>
      </defs>

      <circle cx={C} cy={C} r={R + 40} fill="url(#g-atmo)" className="globe-atmo" />

      {/* back half of the orbits */}
      {ORBITS.map((o, i) => (
        <g key={`ob${i}`} transform={`rotate(${o.tilt} ${C} ${C})`}>
          <path
            d={`M${C - o.rx} ${C} A${o.rx} ${o.ry} 0 0 1 ${C + o.rx} ${C}`}
            className="orbit"
          />
        </g>
      ))}

      <circle cx={C} cy={C} r={R} fill="url(#g-ocean)" />
      <g clipPath="url(#g-clip)">
        <g className="graticule">
          {[...MERIDIANS, ...PARALLELS].map((line, i) => (
            <path key={i} d={linePath(line, lon0, lat0)} />
          ))}
        </g>
        <path d={linePath(EUROPE, lon0, lat0, true)} className="land" />
        <path d={linePath(ARABIA, lon0, lat0, true)} className="land" />
        <path d={linePath(AFRICA, lon0, lat0, true)} className="land" />
        <path d={linePath(CAMEROON_OUTLINE, lon0, lat0, true)} className="land-home" filter="url(#g-glow)" />
        {hub &&
          dots
            .filter((d) => d !== hub)
            .map(({ r, p }) => {
              const mx = (hub.p.x + p.x) / 2
              const my = (hub.p.y + p.y) / 2
              const lift = 0.18 * Math.hypot(p.x - hub.p.x, p.y - hub.p.y) + 6
              return <path key={r.id} className="arc" d={`M${hub.p.x} ${hub.p.y} Q${mx} ${my - lift} ${p.x} ${p.y}`} />
            })}
        <circle cx={C} cy={C} r={R} fill="url(#g-shade)" />
      </g>
      <circle cx={C} cy={C} r={R} className="globe-rim" />

      {dots.map(({ r, p }) => {
        const current = r.id === currentId
        const clickable = !!onSelect && r.has_data && !current
        return (
          <g
            key={r.id}
            className={`city${current ? ' city-current' : ''}${r.has_data ? '' : ' city-empty'}`}
            transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
            onClick={clickable ? () => onSelect!(r.id) : undefined}
            style={{ cursor: clickable ? 'pointer' : 'default' }}
          >
            <title>{r.has_data ? r.name : `${r.name} (no data yet)`}</title>
            <circle r={current ? 14 : 9} className="city-pulse" />
            <circle r={8} className="city-hit" />
            <circle r={current ? 4.5 : 3} className="city-dot" />
          </g>
        )
      })}

      {/* front half of the orbits, with a satellite each */}
      {ORBITS.map((o, i) => {
        const a = o.offset + t * o.speed
        const sx = C + o.rx * Math.cos(a)
        const sy = C + o.ry * Math.sin(a)
        const front = Math.sin(a) > 0 || Math.hypot(sx - C, sy - C) > R
        return (
          <g key={`of${i}`} transform={`rotate(${o.tilt} ${C} ${C})`}>
            <path d={`M${C + o.rx} ${C} A${o.rx} ${o.ry} 0 0 1 ${C - o.rx} ${C}`} className="orbit orbit-front" />
            {front && <circle cx={sx} cy={sy} r={3.5} className="satellite" filter="url(#g-glow)" />}
          </g>
        )
      })}
    </svg>
  )
}
