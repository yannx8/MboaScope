import { useState, type RefObject } from 'react'
import { annualCsv, copyText, DEMO_WARNING, downloadBlob, fileStem, svgToPng } from '../../services/exportData'
import type { RainfallSeriesResponse } from '../../types/api'

/** Copy the link to this exact investigation, download the annual totals, save the chart. */
export function ShareBar({ series, chart }: { series: RainfallSeriesResponse | null; chart?: RefObject<HTMLElement | null> }) {
  const [status, setStatus] = useState('')
  const say = (text: string) => {
    setStatus(text)
    window.setTimeout(() => setStatus((s) => (s === text ? '' : s)), 2500)
  }
  const stem = series ? fileStem(series.region_id, series.period[0], series.period[1]) : 'mboascope'

  const copyLink = async () => {
    try {
      await copyText(window.location.href)
      say('Link copied. It opens this region and period.')
    } catch (err) {
      say((err as Error).message)
    }
  }
  const csv = () => {
    if (!series) return
    downloadBlob(new Blob([annualCsv(series)], { type: 'text/csv;charset=utf-8' }), `${stem}.csv`)
    say('CSV downloaded.')
  }
  const png = async () => {
    const svg = chart?.current?.querySelector<SVGSVGElement>('svg.recharts-surface')
    if (!svg || !series) return
    try {
      const caption = [
        `${series.box_label}, ${series.period[0]} to ${series.period[1]}. ${series.provenance.dataset}, doi:${series.provenance.doi}.`,
        'Satellite estimates averaged over the box. MboaScope.',
        ...(series.is_mock ? [DEMO_WARNING] : []),
      ]
      downloadBlob(await svgToPng(svg, caption), `${stem}.png`)
      say('Chart saved as an image.')
    } catch (err) {
      say((err as Error).message)
    }
  }

  return (
    <div className="share-bar">
      <button type="button" className="share-btn" onClick={copyLink}>
        Copy link
      </button>
      <button type="button" className="share-btn" onClick={csv} disabled={!series}>
        CSV
      </button>
      {chart && (
        <button type="button" className="share-btn" onClick={png} disabled={!series}>
          Image
        </button>
      )}
      <span className="share-status" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  )
}
