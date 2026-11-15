import 'leaflet/dist/leaflet.css'
import type { FeatureCollection } from 'geojson'
import { useEffect, useState } from 'react'
import { CircleMarker, GeoJSON, MapContainer, Pane, Rectangle, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { Bounds, Region, SpatialResponse } from '../../types/api'
import { loadAdminBoundaries } from './adminBoundaries'

const CAMEROON: [[number, number], [number, number]] = [
  [1.6, 8.4],
  [13.1, 16.2],
]
const HALF_CELL = 0.05

const toLatLng = (b: Bounds): [[number, number], [number, number]] => [
  [b[0], b[2]],
  [b[1], b[3]],
]

// Diverging scale: brown drier, near-white for about zero, blue wetter (same stops as the CSS legend).
const DRY: [number, number, number][] = [
  [244, 241, 234],
  [217, 180, 140],
  [142, 74, 18],
]
const WET: [number, number, number][] = [
  [244, 241, 234],
  [156, 187, 224],
  [29, 92, 158],
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.55}
            eventHandlers={{ tileerror: onTileError }}
          />
        )}
        <FitTo target={target} />
        {admin && (
          <GeoJSON
            data={admin}
            style={{ color: '#6b746c', weight: 1, fillColor: '#fbf8f1', fillOpacity: showTiles ? 0.25 : 1 }}
            interactive={false}
          />
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
                color: '#17231c',
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
              {/* White halo under a dark outline: readable on brown, blue, paper or tiles. */}
              <Rectangle bounds={toLatLng(selected.boxes.box_3x3.bounds)} pathOptions={{ color: '#ffffff', weight: 7, fill: false, interactive: false }} />
              <Rectangle bounds={toLatLng(selected.boxes.box_3x3.bounds)} pathOptions={{ color: '#17231c', weight: 3, fill: false }}>
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
                pathOptions={{ color: '#ffffff', weight: 2, fillColor: r.has_data ? '#0b6b4b' : '#9aa59c', fillOpacity: 1 }}
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
