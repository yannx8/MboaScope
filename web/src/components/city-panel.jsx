import { content } from '../content.js'
import { VERDICT_CLASS, num, pValue, signed } from '../lib/format.js'
import { IconInfo } from './icons.jsx'

// City picker and city result (contract proposal #39). Shown only when
// analysis.json has a `cities` array. Douala stays the fixed headline above.

export function PlacePicker({ cities, annual, headlineBox, place, onChange }) {
  const options = [{ box: headlineBox, name: content.placeDouala, headline: true }].concat(
    cities.map((c) => ({ box: c.box, name: content.cityNames[c.box] ?? annual.boxes[c.box]?.label ?? c.box })),
  )
  return (
    <fieldset className="picker">
      <legend className="picker-legend">{content.placeLegend}</legend>
      <div className="picker-row">
        {options.map((o) => (
          <label key={o.box} className={`picker-opt ${place === o.box ? 'is-on' : ''}`}>
            <input
              type="radio"
              name="place"
              value={o.box}
              checked={place === o.box}
              onChange={() => onChange(o.box)}
            />
            <span>{o.name}</span>
            {o.headline && <span className="picker-tag">{content.placeHeadlineTag}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// Tiny bar strip of the city's annual totals (values from annual.json, gaps kept).
function Bars({ years }) {
  const ok = years.filter((y) => y.complete !== false)
  if (ok.length === 0) return null
  const max = Math.max(...ok.map((y) => y.total_mm))
  return (
    <div className="mini-bars" aria-hidden="true">
      {years.map((y) => (
        <span
          key={y.year}
          className={y.complete === false ? 'gap' : ''}
          style={{ height: y.complete === false ? '100%' : `${(y.total_mm / max) * 100}%` }}
        />
      ))}
    </div>
  )
}

export default function CityPanel({ row, annual, a }) {
  const box = annual.boxes[row.box]
  const [lo, hi] = row.sen_ci95 ?? [null, null]
  const tone = VERDICT_CLASS[row.verdict] ?? 'is-neutral'
  const nTests = a?.cities_n_tests
  const fp = a?.cities_expected_false_positives
  return (
    <div className={`city-panel ${tone}`} aria-live="polite">
      <p className="city-top">
        <span className="badge badge-warn">{content.placeExploratory}</span>
      </p>
      <h3 className="city-name">{box.label}</h3>
      <p className="verdict-chip">
        <span aria-hidden="true">{content.verdictSymbol[row.verdict] ?? '?'}</span>{' '}
        {content.verdictShort[row.verdict] ?? row.verdict}
      </p>
      <p className="city-slope">
        <span className="city-big">{signed(row.sen_slope_mm_per_year)}</span>
        <span className="slope-unit">{content.slopeUnit}</span>
      </p>
      <p className="city-ci">{content.ciText(signed(lo), signed(hi))}</p>
      <dl className="city-stats">
        <div>
          <dt>{content.pLabel}</dt>
          <dd>{pValue(row.p)}</dd>
        </div>
        <div>
          <dt>{content.yearsLabel}</dt>
          <dd>{num(row.n_years)}</dd>
        </div>
        {row.mean_annual_mm !== undefined && (
          <div>
            <dt>{content.meanLabel}</dt>
            <dd>
              {num(row.mean_annual_mm)} {content.mmUnit}
            </dd>
          </div>
        )}
        {row.pct_per_decade !== undefined && (
          <div>
            <dt>{content.pctLabel}</dt>
            <dd>
              {signed(row.pct_per_decade)} {content.pctUnit}
            </dd>
          </div>
        )}
      </dl>
      <Bars years={box.years ?? []} />
      <p className="city-note">
        <IconInfo size={15} />
        <span>
          {nTests !== undefined && fp !== undefined
            ? content.placeMultiple(num(nTests), num(fp))
            : content.placeMultipleNoNumbers}{' '}
          {content.placeScope}
        </span>
      </p>
    </div>
  )
}
