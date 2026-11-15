import 'leaflet/dist/leaflet.css'
import type { FeatureCollection } from 'geojson'
import { useEffect, useState } from 'react'
import { CircleMarker, GeoJSON, MapContainer, Pane, Polygon, Rectangle, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { Bounds, Region, SpatialResponse } from '../../types/api'
import { CAMEROON_OUTLINE } from '../common/Globe'
import { loadAdminBoundaries } from './adminBoundaries'

// Simplified outline, used only until A3's boundary file exists.
const OUTLINE: [number, number][] = CAMEROON_OUTLINE.map(([lon, lat]) => [lat, lon])

const CAMEROON: [[number, number], [number, number]] = [
  [1.6, 8.4],
  [13.1, 16.2],
]
const HALF_CELL = 0.05

const toLatLng = (b: Bounds): [[number, number], [number, number]] => [
  [b[0], b[2]],
  [b[1], b[3]],
]

// Diverging scale for the dark theme: brown drier, dark slate for about zero, blue wetter
// (same stops as the CSS legend). Brighter means a larger change.
const DRY: [number, number, number][] = [
  [38, 52, 47],
  [150, 96, 52],
  [240, 178, 118],
]
const WET: [number, number, number][] = [
  [38, 52, 47],
  [70, 118, 170],
  [150, 200, 250],
]

function mix(stops: [number, number, number][], t: number): string {
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1)
  const i = Math.min(Math.floor(x), stops.length - 2)
  const f = x - i
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

/** Fill colour for a cell. `scale` is the largest absolute slope on the map, used only to stretch the colours. */
export function cellColour(slope: number, scale: number): string {
  const t = scale > 0 ? Math.abs(slope) / scale : 0
  return slope >= 0 ? mix(WET, t) : mix(DRY, t)
}

function FitTo({ target }: { target: [[number, number], [number, number]] }) {
  const map = useMap()
  const key = target.flat().join(',')
  useEffect(() => {
    map.flyToBounds(target, { padding: [20, 20], duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

export function RegionMap({
  regions,
  selected,
  spatial,
  scale,
  view,
  showTiles,
  onTileError,
  onSelect,
}: {
  regions: Region[]
  selected: Region | null
  spatial: SpatialResponse | null
  scale: number
  view: 'region' | 'country'
  showTiles: boolean
  onTileError: () => void
  onSelect: (id: string) => void
}) {
  const [admin, setAdmin] = useState<FeatureCollection | null>(null)
  useEffect(() => {
    let live = true
    loadAdminBoundaries().then((fc) => live && setAdmin(fc))
    return () => {
      live = false
    }
  }, [])

  const cells = spatial?.available ? spatial.cells : []
  const alpha = spatial?.alpha ?? 0.05
  const target = view === 'region' && selected ? toLatLng(selected.grid_bounds) : CAMEROON

  return (
    <div className="map" role="region" aria-label="Map of the study regions. The same information is in the region list and the table below the map.">
      <MapContainer bounds={CAMEROON} zoomSnap={0.25} scrollWheelZoom={false} style={{ height: '100%' }} attributionControl>
        {showTiles && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            opacity={0.9}
            eventHandlers={{ tileerror: onTileError }}
          />
        )}
        <FitTo target={target} />
        {admin ? (
          <GeoJSON
            data={admin}
            style={{ color: '#9ff0cf', weight: 1, opacity: 0.6, fillColor: '#6fe0b4', fillOpacity: showTiles ? 0.04 : 0.08 }}
            interactive={false}
          />
        ) : (
          !showTiles && (
            <Polygon
              positions={OUTLINE}
              pathOptions={{ color: '#9ff0cf', weight: 1.2, opacity: 0.55, fillColor: '#6fe0b4', fillOpacity: 0.07, interactive: false }}
            />
          )
        )}
        <Pane name="cells" style={{ zIndex: 410 }}>
          {cells.map((c) => (
            <Rectangle
              key={`${c.lat},${c.lon}`}
              bounds={[
                [c.lat - HALF_CELL, c.lon - HALF_CELL],
                [c.lat + HALF_CELL, c.lon + HALF_CELL],
              ]}
              pathOptions={{
                stroke: c.p < alpha,
                color: '#eafff6',
                weight: 1.25,
                fillColor: cellColour(c.sen_slope_mm_per_year, scale),
                fillOpacity: 0.92,
              }}
            >
              <Tooltip>
                {c.lat.toFixed(2)}° N, {c.lon.toFixed(2)}° E: {c.sen_slope_mm_per_year > 0 ? '+' : ''}
                {c.sen_slope_mm_per_year} mm/yr, p = {c.p.toFixed(3)}, mean {c.mean_annual_mm} mm
              </Tooltip>
            </Rectangle>
          ))}
        </Pane>
        <Pane name="box" style={{ zIndex: 420 }}>
          {selected && (
            <>
              {/* Dark halo under a gold outline: readable on brown, blue, slate or tiles. Gold = selected, as on the dashboard. */}
              <Rectangle bounds={toLatLng(selected.boxes.box_3x3.bounds)} pathOptions={{ color: '#02110c', weight: 7, opacity: 0.75, fill: false, interactive: false }} />
              <Rectangle bounds={toLatLng(selected.boxes.box_3x3.bounds)} pathOptions={{ color: '#f3d27a', weight: 2.5, fill: false }}>
                <Tooltip sticky>{selected.boxes.box_3x3.label}: the headline box</Tooltip>
              </Rectangle>
            </>
          )}
        </Pane>
        <Pane name="dots" style={{ zIndex: 430 }}>
          {regions.map((r) => {
            const isSel = r.id === selected?.id
            // Put the label on the left when another capital sits just to the east (Buea and Douala).
            const crowded = regions.some((o) => o.id !== r.id && o.centre[1] > r.centre[1] && o.centre[1] - r.centre[1] < 1 && Math.abs(o.centre[0] - r.centre[0]) < 0.3)
            return (
              <CircleMarker
                key={r.id}
                center={r.centre}
                radius={isSel ? 8 : 6}
                pathOptions={{
                  color: isSel ? '#f3d27a' : '#02110c',
                  weight: isSel ? 3 : 2,
                  fillColor: isSel ? '#fff6c9' : r.has_data ? '#6fe0b4' : '#5f6f68',
                  fillOpacity: 1,
                  className: isSel ? 'map-dot map-dot-current' : 'map-dot',
                }}
                eventHandlers={{ click: () => r.has_data && onSelect(r.id) }}
              >
                <Tooltip key={`${view}-${isSel}`} permanent={view === 'country' || isSel} direction={crowded ? 'left' : 'right'} offset={crowded ? [-8, 0] : [8, 0]} className="map-label">
                  {r.name}
                  {r.has_data ? '' : ' (no data)'}
                </Tooltip>
              </CircleMarker>
            )
          })}
        </Pane>
      </MapContainer>
    </div>
  )
}
