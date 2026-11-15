import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnnualChart } from '../components/charts/AnnualChart'
import { Card } from '../components/common/Card'
import { IconChart, IconChat, IconMap } from '../components/common/Icons'
import { ApiProblem, PeriodProblem, Skeleton } from '../components/common/Status'
import { AnswerCard } from '../components/dashboard/AnswerCard'
import { RegionPicker } from '../components/maps/RegionPicker'
import { Hero } from '../components/dashboard/Hero'
import { InvestigationControls } from '../components/dashboard/InvestigationControls'
import { CaveatList } from '../components/dashboard/CaveatList'
import { RegionComparison } from '../components/dashboard/RegionComparison'
import { useApi } from '../hooks/useApi'
import { periodIsValid, useInvestigation } from '../hooks/useInvestigation'
import { api } from '../services/api'

export default function Dashboard() {
  const { request, region } = useInvestigation()
  const { search, hash } = useLocation()
  // A link to /#answer opens straight on the region picker.
  useEffect(() => {
    if (hash === '#answer') document.getElementById('answer')?.scrollIntoView({ block: 'start' })
  }, [hash])
  const ok = periodIsValid(request)
  const key = [request.region_id, request.start_year, request.end_year]
  const trends = useApi(() => api.trends(request), key, ok)
  const series = useApi(() => api.rainfallSeries(request), key, ok)

  const h = trends.data?.headline

  return (
    <>
      <Hero />
      <section id="answer" tabIndex={-1} className="controls-panel" aria-labelledby="choose-title">
        <div className="controls-panel-map">
          <RegionPicker />
        </div>
        <div className="controls-panel-form">
          <h2 id="choose-title">Choose a region</h2>
          <p className="muted">
            Select a city on the map, or use the menus. Each region is a box of satellite cells around its regional capital.
          </p>
          <InvestigationControls />
        </div>
      </section>
      {!ok ? (
        <PeriodProblem />
      ) : (
    <div className="grid">
      <div className="span-12">
        {trends.error ? (
          <ApiProblem status={trends.status} message={trends.error} onRetry={trends.reload} />
        ) : !h || trends.loading ? (
          <Skeleton kind="answer" label="Running the trend tests…" />
        ) : (
          <AnswerCard h={h} region={region} />
        )}
      </div>

      {h && !trends.loading && (
        <>
          <div className="span-8">
            <Card fill title="Annual rainfall" subtitle={`${series.data?.box_label ?? 'Headline box'}, satellite estimate`}>
              {series.error ? (
                <ApiProblem status={series.status} message={series.error} onRetry={series.reload} />
              ) : series.data ? (
                <AnnualChart years={series.data.years} h={h} height={270} />
              ) : (
                <Skeleton kind="chart" label="Loading the annual totals…" />
              )}
            </Card>
          </div>
          <div className="span-4">
            <Card fill title="Read this before quoting">
              <CaveatList caveats={h.caveats} />
              <p className="muted" style={{ marginTop: '0.85rem' }}>
                The <Link to={{ pathname: '/assistant', search }}>Assistant</Link> explains each point in plain language.
              </p>
            </Card>
          </div>
        </>
      )}

      <div className="span-12">
        <Card
          title={`All regions, ${request.start_year} to ${request.end_year}`}
          subtitle="The same test for every regional capital. Choose a name to open it."
        >
          <RegionComparison />
        </Card>
      </div>

      <div className="span-12 next-steps">
        <Link className="tile" to={{ pathname: '/explorer', search }}>
          <IconMap />
          <strong>See it on the map</strong>
          <span>The study box and the exploratory per-cell trends.</span>
        </Link>
        <Link className="tile" to={{ pathname: '/analysis', search }}>
          <IconChart />
          <strong>All test results</strong>
          <span>Every number, the seasonal cycle and robustness checks.</span>
        </Link>
        <Link className="tile" to={{ pathname: '/assistant', search }}>
          <IconChat />
          <strong>Explain it</strong>
          <span>What it means, what it does not mean, and your own questions.</span>
        </Link>
      </div>
    </div>
      )}
    </>
  )
}
