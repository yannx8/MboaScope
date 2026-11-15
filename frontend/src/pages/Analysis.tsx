import { useRef } from 'react'
import { AnnualChart } from '../components/charts/AnnualChart'
import { Term } from '../components/common/Term'
import { ShareBar } from '../components/common/ShareBar'
import { ClimatologyChart } from '../components/charts/ClimatologyChart'
import { Card } from '../components/common/Card'
import { ApiProblem, PeriodProblem, Skeleton } from '../components/common/Status'
import { VerdictChip } from '../components/common/VerdictChip'
import { useApi } from '../hooks/useApi'
import { periodIsValid, useInvestigation } from '../hooks/useInvestigation'
import { api } from '../services/api'
import { BOX_NAME, num, pValue, signed, testName } from '../services/format'

export default function Analysis() {
  const { request, regions } = useInvestigation()
  const chartRef = useRef<HTMLDivElement>(null)
  const ok = periodIsValid(request)
  const key = [request.region_id, request.start_year, request.end_year]
  const trends = useApi(() => api.trends(request), key, ok)
  const series = useApi(() => api.rainfallSeries(request), key, ok)
  const history = useApi(() => api.history(8), [trends.data?.investigation_id], !!trends.data)

  if (!ok) return <PeriodProblem />
  const failed = trends.error ? trends : series.error ? series : null
  if (failed) return <ApiProblem status={failed.status} message={failed.error ?? ''} onRetry={failed.reload} />
  if (!trends.data || !series.data) return <Skeleton kind="chart" label="Loading the analysis…" />
  const h = trends.data.headline
  const sd = series.data
  const nameOf = (id: string) => regions.find((r) => r.id === id)?.name ?? id

  return (
    <div className="grid">
      <div className="span-12">
        <Card
          title={`Annual rainfall, ${sd.region_name}`}
          subtitle={`${sd.box_label}. ${h.dataset}, ${h.period}.`}
          action={<ShareBar series={sd} chart={chartRef} />}
        >
          <div ref={chartRef}>
            <AnnualChart years={sd.years} h={h} />
          </div>
          {sd.excluded_years.length > 0 && (
            <p className="note note-info">
              <span>Left out because months are missing (never filled in): {sd.excluded_years.join(', ')}.</span>
            </p>
          )}
          {sd.warnings.map((w) => (
            <p key={w} className="note" role="alert">
              <span>{w}</span>
            </p>
          ))}
        </Card>
      </div>

      <div className="span-7">
        <Card fill title="Test results" subtitle={`Primary test: ${testName(h.mk_test_used)}. Significance level ${h.alpha}.`}>
          <table className="table table-kv">
            <caption className="sr-only">All headline test results</caption>
            <tbody>
              <tr><th scope="row"><Term id="significant">Verdict</Term></th><td><VerdictChip verdict={h.verdict} /></td></tr>
              <tr><th scope="row"><Term id="sen_slope">Sen's slope</Term> (size of the change)</th><td>{signed(h.sen_slope_mm_per_year)} mm/yr, 95% CI {signed(h.sen_ci95[0])} to {signed(h.sen_ci95[1])}</td></tr>
              <tr><th scope="row"><Term id="per_decade">Relative change</Term></th><td>{signed(h.pct_per_decade)}% per decade</td></tr>
              <tr><th scope="row"><Term id="mann_kendall">Mann-Kendall</Term> (original){h.mk_test_used === 'original' ? ', primary' : ''}</th><td>τ = {h.mk_original.tau}, z = {h.mk_original.z}, p = {pValue(h.mk_original.p)}</td></tr>
              <tr><th scope="row"><Term id="hamed_rao">Hamed-Rao</Term> modified{h.mk_test_used === 'hamed_rao' ? ', primary' : ''}</th><td>z = {h.mk_hamed_rao.z}, p = {pValue(h.mk_hamed_rao.p)}</td></tr>
              <tr><th scope="row"><Term id="autocorrelation">Lag-1 autocorrelation</Term></th><td>{h.lag1_autocorr} ({h.autocorr_significant ? 'significant, so Hamed-Rao is primary' : 'not significant'})</td></tr>
              <tr>
                <th scope="row"><Term id="pettitt">Pettitt change point</Term></th>
                <td>
                  {h.pettitt.change_year}, p = {pValue(h.pettitt.p)} ({h.pettitt.significant ? 'significant' : 'not significant'})
                  {h.pettitt.significant && h.pettitt.change_year >= 2013 && h.pettitt.change_year <= 2015 && (
                    <span className="chip chip-marker" style={{ marginLeft: '0.4rem' }}>at the 2014 satellite change</span>
                  )}
                </td>
              </tr>
              <tr><th scope="row">Mean annual total</th><td>{num(h.mean_annual_mm)} mm over {h.n_years} complete years</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div className="span-5">
        <Card fill title="Seasonal cycle" subtitle="Mean rainfall in each calendar month, selected years">
          <ClimatologyChart data={sd.climatology} />
        </Card>
      </div>

      <div className="span-7">
        <Card fill title="Robustness checks" subtitle="The same test on smaller and larger boxes. These never replace the headline.">
          {trends.data.sensitivity.length === 0 ? (
            <p className="muted">Not available for this data source (area-averaged data only).</p>
          ) : (
            <div className="table-scroll" style={{ maxHeight: 'none' }} tabIndex={0} role="region" aria-label="Robustness checks">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Box</th>
                    <th scope="col">Result</th>
                    <th scope="col" className="num">mm/yr</th>
                    <th scope="col" className="num hide-sm">95% CI</th>
                    <th scope="col" className="num">p</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.data.sensitivity.map((r) => (
                    <tr key={r.box + r.dataset}>
                      <th scope="row">
                        {BOX_NAME[r.box] ?? r.box}
                        <span className="small" style={{ display: 'block', fontWeight: 400 }}>{r.dataset}</span>
                      </th>
                      <td><VerdictChip verdict={r.verdict} /></td>
                      <td className="num">{signed(r.sen_slope_mm_per_year)}</td>
                      <td className="num hide-sm nowrap">{signed(r.sen_ci95[0])} to {signed(r.sen_ci95[1])}</td>
                      <td className="num">{pValue(r.p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="span-5">
        <Card fill title="Data and provenance">
          <dl className="facts" style={{ marginTop: 0 }}>
            <dt>Dataset</dt><dd>{sd.provenance.dataset}</dd>
            <dt>DOI</dt><dd><a href={`https://doi.org/${sd.provenance.doi}`}>{sd.provenance.doi}</a></dd>
            <dt>Access</dt><dd>{sd.provenance.access_method}{sd.is_mock ? ' (synthetic demo data)' : ''}</dd>
            <dt>Units in file</dt><dd>{sd.provenance.source_units}</dd>
            <dt>Available</dt><dd>{sd.provenance.period.join(' to ')}</dd>
          </dl>
          {sd.provenance.notes.map((n) => <p key={n} className="small" style={{ marginTop: '0.6rem' }}>{n}</p>)}
          {history.data && history.data.length > 0 && (
            <>
              <h3>Recent investigations</h3>
              <ul className="small" style={{ paddingLeft: '1.1rem', margin: 0 }}>
                {history.data.map((i) => (
                  <li key={i.id}>
                    {nameOf(i.region_id)}, {i.start_year} to {i.end_year}: <VerdictChip verdict={i.verdict} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
