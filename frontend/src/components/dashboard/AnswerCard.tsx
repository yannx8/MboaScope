import { periodLabel, primaryP, pValue, signed, VERDICT_PLAIN, VERDICT_TEXT, VERDICT_TONE } from '../../services/format'
import type { Headline, Region } from '../../types/api'
import { IconDown, IconFlat, IconInfo, IconUp } from '../common/Icons'

/** The one question MboaScope answers, for the selected region and period. */
export function AnswerCard({ h, region }: { h: Headline; region: Region | null }) {
  const tone = VERDICT_TONE[h.verdict]
  const [start, end] = h.period.split('-').map(Number)
  const [lo, hi] = h.sen_ci95
  const Icon = tone === 'wetter' ? IconUp : tone === 'drier' ? IconDown : IconFlat
  return (
    <section className={`answer answer-${tone}`} aria-labelledby="answer-title" aria-describedby="answer-plain">
      <p className="answer-q">
        Has rainfall changed around {h.region_name}, {periodLabel(start, end)}?
      </p>
      <h1 id="answer-title" className="answer-verdict">
        <span className="answer-icon"><Icon /></span>
        {VERDICT_TEXT[h.verdict]}
      </h1>
      <p id="answer-plain" className="answer-plain">
        {VERDICT_PLAIN[h.verdict]}
      </p>
      <dl className="answer-stats">
        <div>
          <dt>Estimated change</dt>
          <dd>
            {signed(h.sen_slope_mm_per_year)} <small>mm per year</small>
          </dd>
        </div>
        <div>
          <dt>95% interval</dt>
          <dd>
            {signed(lo)} to {signed(hi)}
          </dd>
        </div>
        <div>
          <dt>Per decade</dt>
          <dd>
            {signed(h.pct_per_decade)}% <small>of the mean</small>
          </dd>
        </div>
        <div>
          <dt>p-value</dt>
          <dd>
            {pValue(primaryP(h))} <small>(significant below {h.alpha})</small>
          </dd>
        </div>
      </dl>
      <p className="answer-foot">
        {h.n_years} complete years. Mean {h.mean_annual_mm.toLocaleString('en-GB')} mm per year. Satellite estimate over a box of about 33
        km around {h.region_name}, not a station reading.
      </p>
      {region && !region.verified && (
        <p className="note" role="note">
          <IconInfo />
          <span>
            <strong>Provisional.</strong> The study box for {region.name} has not yet been checked on a map. Do not publish this
            result yet.
          </span>
        </p>
      )}
    </section>
  )
}
