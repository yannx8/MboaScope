import { useApi } from '../../hooks/useApi'
import { useInvestigation } from '../../hooks/useInvestigation'
import { api } from '../../services/api'
import type { InvestigationLog } from '../../types/api'
import { VerdictChip } from '../common/VerdictChip'

/** Most recent run of each region and period, newest first. The API log can repeat the same investigation. */
export function latestPerInvestigation(log: InvestigationLog[], limit: number): InvestigationLog[] {
  const seen = new Set<string>()
  const out: InvestigationLog[] = []
  for (const item of [...log].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)) {
    const key = `${item.region_id}|${item.start_year}|${item.end_year}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length === limit) break
  }
  return out
}

/** "5 min ago", "3 h ago", "2 days ago", from the server's UTC timestamp. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (Number.isNaN(s)) return ''
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

/** Investigations run on this server, each one a click away. Refreshes when a new investigation is logged. */
export function RecentInvestigations({ refreshKey, limit = 6 }: { refreshKey?: unknown; limit?: number }) {
  const { regions, request, setRequest } = useInvestigation()
  const log = useApi(() => api.history(30), [refreshKey])
  const nameOf = (id: string) => regions.find((r) => r.id === id)?.name ?? id

  if (log.loading && !log.data) return <p className="small">Loading recent investigations…</p>
  if (log.error) return <p className="small">Recent investigations are unavailable right now.</p>
  const items = latestPerInvestigation(log.data ?? [], limit)
  if (items.length === 0) return <p className="small">No investigations yet. Choose a region to run the first one.</p>

  return (
    <ul className="recent">
      {items.map((i) => {
        const current = i.region_id === request.region_id && i.start_year === request.start_year && i.end_year === request.end_year
        return (
          <li key={i.id} className={current ? 'current' : undefined}>
            <button
              type="button"
              className="recent-open"
              aria-current={current ? 'true' : undefined}
              disabled={current}
              onClick={() => setRequest({ region_id: i.region_id, start_year: i.start_year, end_year: i.end_year })}
            >
              <strong>{nameOf(i.region_id)}</strong>
              <span>
                {i.start_year} to {i.end_year}
              </span>
            </button>
            <VerdictChip verdict={i.verdict} />
            <span className="recent-meta">
              {timeAgo(i.created_at)}
              {i.is_mock ? ', demo data' : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
