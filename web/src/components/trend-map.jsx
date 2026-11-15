import { Suspense, lazy, useState } from 'react'
import { content } from '../content.js'
import { boxLabel, num, signed } from '../lib/format.js'
import CityPanel, { PlacePicker } from './city-panel.jsx'
import { IconInfo, IconMap } from './icons.jsx'
import { Section } from './section.jsx'

// Leaflet is loaded as its own chunk, only when this section renders.
const TrendMapLeaflet = lazy(() => import('./trend-map-leaflet.jsx'))

// Section 5. The study boxes and the exploratory per-cell trend grid.
// The false-positive label is always shown next to the grid.
export default function TrendMap({ spatial, annual, analysis }) {
  return (
    <Section
      id="map"
      title={content.mapHeading}
      subtitle={annual.data ? content.mapIntro(boxLabel(annual.data, analysis.data?.headline?.box ?? 'box_3x3')) : null}
      icon={IconMap}
      files={[
        ['spatial', spatial],
        ['annual', annual],
      ]}
    >
      {spatial.data && annual.data && (
        <MapBody
          s={spatial.data}
          annual={annual.data}
          a={analysis.data}
          headlineBox={analysis.data?.headline?.box ?? 'box_3x3'}
        />
      )}
    </Section>
  )
}

const isCity = (id) => id.startsWith('city_')

function MapBody({ s, annual, a, headlineBox }) {
  // City results are optional (contract proposal #39). Without them the picker is hidden.
  const cities = (a?.cities ?? []).filter((c) => annual.boxes?.[c.box])
  const [place, setPlace] = useState(headlineBox)
  const city = cities.find((c) => c.box === place) ?? null
  const focus = city ? annual.boxes[city.box].bounds : null
  const cells = s.available ? (s.cells ?? []) : []
  // Colour scale only: symmetric around zero so brown and blue mean the same everywhere.
  const maxAbs = cells.reduce((m, c) => Math.max(m, Math.abs(c.sen_slope_mm_per_year ?? 0)), 0)
  const boxes = Object.entries(annual.boxes ?? {}).filter(([id]) => !isCity(id))

  return (
    <>
      {s.available ? (
        <p className="callout" role="note">
          <IconInfo size={18} />
          <span>
            <strong>{content.mapExploratory(num(s.n_cells), num(s.expected_false_positives))}</strong>{' '}
            {s.n_significant > 0 ? content.mapSignificant(num(s.n_significant)) : content.mapNoneSignificant}
          </span>
        </p>
      ) : (
        <p className="state">{content.mapUnavailable}</p>
      )}

      {cities.length > 0 && (
        <PlacePicker cities={cities} annual={annual} headlineBox={headlineBox} place={place} onChange={setPlace} />
      )}

      <figure className="map">
        <div className="map-frame" role="img" aria-label={content.mapA11y}>
          <Suspense fallback={<p className="state map-loading">{content.mapLoading}</p>}>
            <TrendMapLeaflet
              s={{ ...s, cells }}
              annual={annual}
              headlineBox={headlineBox}
              maxAbs={maxAbs}
              selected={place}
              focus={focus}
              onSelect={cities.length > 0 ? setPlace : undefined}
            />
          </Suspense>
        </div>
        <figcaption className="map-key">
          {city && <CityPanel row={city} annual={annual} a={a} />}
          {!city && cells.length > 0 && (
            <div className="legend">
              <p className="legend-title">{content.mapLegendTitle}</p>
              <div className="legend-bar" aria-hidden="true" />
              <div className="legend-ends">
                <span>
                  {content.mapLegendDrier}
                  <span className="legend-num">{signed(-maxAbs)}</span>
                </span>
                <span className="center">{content.mapLegendNeutral}</span>
                <span className="right">
                  {content.mapLegendWetter}
                  <span className="legend-num">{signed(maxAbs)}</span>
                </span>
              </div>
              <p className="legend-sig">
                <span className="swatch-sig" aria-hidden="true" /> {content.mapLegendSignificant}
              </p>
            </div>
          )}
          <ul className={`box-key ${city ? 'is-dim' : ''}`}>
            {boxes.map(([id, b]) => (
              <li key={id} className={id === headlineBox ? 'is-headline' : ''}>
                <span className="swatch-box" aria-hidden="true" />
                {b.label}
                {id === headlineBox && <span className="pill">{content.mapHeadlineBox}</span>}
              </li>
            ))}
          </ul>
        </figcaption>
      </figure>
    </>
  )
}
