import { useId } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { num, SENSOR_CHANGE_YEAR, signed, VERDICT_TEXT, VERDICT_TONE } from '../../services/format'
import type { AnnualPoint, Headline } from '../../types/api'
import { DataTable } from '../common/DataTable'

interface Row {
  year: number
  total: number | null
  trend: number | null
}

const TONE_VAR = { wetter: 'var(--wetter)', drier: 'var(--drier)', neutral: 'var(--neutral)' } as const

/** Sen line as the contract defines it: intercept + slope x (year - first year). Drawing only, no fitting. */
export function senLine(h: Headline, year: number): number {
  const first = Number(h.period.split('-')[0])
  return h.sen_intercept_mm + h.sen_slope_mm_per_year * (year - first)
}

/** Annual totals (neutral bars), the Sen line in the colour of the verdict, and the 2014 satellite change. */
export function AnnualChart({ years, h, height = 300 }: { years: AnnualPoint[]; h: Headline | null; height?: number }) {
  const descId = useId()
  const rows: Row[] = years.map((y) => ({
    year: y.year,
    total: y.complete ? y.total_mm : null,
    trend: h ? senLine(h, y.year) : null,
  }))
  const tone = h ? VERDICT_TONE[h.verdict] : 'neutral'
  const showMarker = rows.some((r) => r.year === SENSOR_CHANGE_YEAR)
  const excluded = years.filter((y) => !y.complete).map((y) => y.year)
  const first = years[0]?.year
  const last = years[years.length - 1]?.year

  return (
    <figure className="chart-figure" aria-describedby={descId}>
      <div className="chart" style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="99%" height="100%">
          <ComposedChart data={rows} margin={{ top: 22, right: 6, bottom: 0, left: -6 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 4" />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: 'var(--border-strong)' }} minTickGap={14} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v: number) => num(v)} tickLine={false} axisLine={false} width={50} tick={{ fontSize: 11 }} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              formatter={(value, name) => [
                value === null || value === undefined ? 'excluded' : `${num(Math.round(Number(value)))} mm`,
                name === 'total' ? 'Annual total' : 'Sen trend line',
              ]}
              labelFormatter={(label) => `Year ${label}`}
            />
            <Bar dataKey="total" fill="var(--bar)" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            {h && <Line dataKey="trend" stroke={TONE_VAR[tone]} strokeWidth={3} dot={false} isAnimationActive={false} />}
            {showMarker && (
              <ReferenceLine
                x={SENSOR_CHANGE_YEAR}
                stroke="var(--marker)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                label={{ value: '2014: TRMM → GPM', position: 'top', fill: 'var(--marker)', fontSize: 11 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption>
        <ul className="chart-key">
          <li><span className="key-bar" aria-hidden="true" /> Annual total (mm)</li>
          {h && <li><span className={`key-line tone-${tone}`} aria-hidden="true" /> Sen trend line</li>}
          {showMarker && <li><span className="key-dash" aria-hidden="true" /> 2014 satellite change</li>}
          {excluded.length > 0 && <li><span className="key-gap" aria-hidden="true" /> Gap: year with missing months, left out</li>}
        </ul>
        <p id={descId} className="sr-only">
          Bar chart of annual rainfall totals, {first} to {last}, one bar per year.
          {h &&
            ` The trend line changes by ${signed(h.sen_slope_mm_per_year)} mm per year. Verdict: ${VERDICT_TEXT[h.verdict].toLowerCase()}.`}
          {showMarker && ' A dashed line marks the 2014 satellite change.'}
          {excluded.length > 0 && ` Years left out: ${excluded.join(', ')}.`} The table below lists every value.
        </p>
      </figcaption>
      <DataTable
        summary="Show the numbers"
        caption={`Annual totals, ${first} to ${last}`}
        head={
          <tr>
            <th scope="col">Year</th>
            <th scope="col" className="num">Total (mm)</th>
            <th scope="col" className="num">Months</th>
          </tr>
        }
        rows={years.map((y) => (
          <tr key={y.year}>
            <th scope="row">{y.year}</th>
            <td className="num">{y.complete ? num(y.total_mm) : 'excluded'}</td>
            <td className="num">{y.months_present}</td>
          </tr>
        ))}
      />
    </figure>
  )
}
