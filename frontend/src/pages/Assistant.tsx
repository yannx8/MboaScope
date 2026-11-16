import { useState } from 'react'
import { AskBox } from '../components/assistant/AskBox'
import { Card } from '../components/common/Card'
import { ApiProblem, Loading, PeriodProblem, StateMessage } from '../components/common/Status'
import { useApi } from '../hooks/useApi'
import { periodIsValid, useInvestigation } from '../hooks/useInvestigation'
import { api } from '../services/api'
import { CAVEAT_TITLE } from '../services/format'

export default function Assistant() {
  const { request, setRequest, regions } = useInvestigation()
  const [useLlm, setUseLlm] = useState(false)
  const ok = periodIsValid(request)
  const key = [request.region_id, request.start_year, request.end_year]
  const res = useApi(() => api.interpret({ ...request, use_llm: useLlm }), [...key, useLlm], ok)
  const trends = useApi(() => api.trends(request), key, ok)

  if (!ok) return <PeriodProblem />
  if (res.error && !res.loading) return <ApiProblem status={res.status} message={res.error} onRetry={res.reload} />
  const e = res.data?.explanation
  const caveats = trends.data?.headline.caveats ?? []

  return (
    <div className="grid">
      <div className="span-8 stack">
        <Card
          title="What the result says"
          subtitle="Written only from the computed statistics. Every number and claim is checked by code before it is shown."
          action={
            <label className="switch">
              <input type="checkbox" checked={useLlm} onChange={(ev) => setUseLlm(ev.target.checked)} />
              Easier wording (Gemini)
            </label>
          }
        >
          {res.loading && <Loading label={useLlm ? 'Asking Gemini, then checking its answer…' : 'Writing the explanation…'} />}
          {e && !e.checks_passed && (
            <StateMessage tone="error" title="The explanation is hidden">
              <p>It failed one of its checks, so it is not shown. The numbers on the Analysis page are still correct.</p>
            </StateMessage>
          )}
          {e && e.checks_passed && !res.loading && (
            <article className="explanation">
              <p className="lead">{e.summary}</p>
              <h3>What it means</h3>
              <p>{e.what_it_means}</p>
              <h3>What it does not mean</h3>
              <p>{e.what_it_does_not_mean}</p>
              <h3>Limitations</h3>
              <ul>
                {e.limitations.map((l, i) => (
                  <li key={l}>
                    <strong>{CAVEAT_TITLE[caveats[i]] ?? 'Limitation'}.</strong> {l}
                  </li>
                ))}
              </ul>
              <p className="small source-line">
                {e.source === 'gemini' ? `Worded by ${e.model}, then checked.` : 'Written from a checked template.'}
                {res.data?.notes.length ? ` Gemini was not used: ${res.data.notes.join('; ')}.` : ''}
              </p>
            </article>
          )}
        </Card>
        <Card title="Ask a question" subtitle={'Answers come only from the computed results. Anything else gets "I can only answer from the computed results."'}>
          <AskBox useLlm={useLlm} />
        </Card>
      </div>
      <div className="span-4">
        <Card fill title="Investigate next">
          {!res.data && res.loading && <Loading />}
          {res.data?.suggestions.map((s) => (
            <div key={s.title} className="suggestion">
              <strong>{s.title}</strong>
              <p>{s.reason}</p>
              {s.region_id ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => setRequest({ region_id: s.region_id!, start_year: s.start_year, end_year: s.end_year })}
                >
                  Run {s.start_year} to {s.end_year}
                </button>
              ) : (
                <label className="field">
                  <span>Compare with</span>
                  <select defaultValue="" onChange={(ev) => ev.target.value && setRequest({ region_id: ev.target.value })}>
                    <option value="" disabled>
                      Choose a region…
                    </option>
                    {regions
                      .filter((r) => r.has_data && r.id !== request.region_id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
