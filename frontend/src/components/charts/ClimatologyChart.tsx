import { useId } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MONTHS, num } from '../../services/format'
import type { ClimatologyPoint } from '../../types/api'
import { DataTable } from '../common/DataTable'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Mean monthly rainfall over the selected years: the seasonal cycle. */
export function ClimatologyChart({ data }: { data: ClimatologyPoint[] }) {
  const descId = useId()
  const rows = data.map((d) => ({ month: MONTHS[d.month - 1], mm: d.mean_mm }))
  return (
    <figure className="chart-figure" aria-describedby={descId}>
      <div className="chart" style={{ height: 230 }} aria-hidden="true">
        <ResponsiveContainer width="99%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 6, bottom: 0, left: -10 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 4" />
            <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 11 }} interval={0} tickFormatter={(m: string) => m.slice(0, 1)} />
            <YAxis tickFormatter={(v: number) => num(v)} tickLine={false} axisLine={false} width={46} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [`${num(Number(v))} mm`, 'Mean monthly total']} />
            <Bar dataKey="mm" fill="var(--bar)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p id={descId} className="sr-only">
        Bar chart of the mean rainfall for each calendar month over the selected years. The table below lists every value.
      </p>
      <DataTable
        summary="Show the numbers"
        caption="Mean monthly total (mm)"
        head={
          <tr>
            <th scope="col">Month</th>
            <th scope="col" className="num">Mean (mm)</th>
          </tr>
        }
        rows={data.map((d) => (
          <tr key={d.month}>
            <th scope="row">{MONTH_NAMES[d.month - 1]}</th>
            <td className="num">{num(d.mean_mm)}</td>
          </tr>
        ))}
      />
    </figure>
  )
}
