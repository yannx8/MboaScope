// The only module that talks to the backend. Endpoints: docs/api.md.
import type {
  AskRequest,
  AskResponse,
  InterpretResponse,
  InvestigationLog,
  InvestigationRequest,
  RainfallSeriesResponse,
  RegionsResponse,
  SpatialResponse,
  TrendsResponse,
} from '../types/api'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(0, 'The MboaScope server cannot be reached.')
  }
  if (!res.ok) {
    let detail = res.statusText || `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

// The same investigation is asked for by several pages (and by the region comparison).
// Answers are deterministic for a given data version, so keep them for the session.
// Failed requests are not kept. clearCache() runs on "Try again".
const memo = new Map<string, Promise<unknown>>()

function cachedPost<T>(path: string, body: unknown): Promise<T> {
  const key = path + JSON.stringify(body)
  const hit = memo.get(key)
  if (hit) return hit as Promise<T>
  const p = request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  memo.set(key, p)
  p.catch(() => memo.delete(key))
  return p
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

const investigation = (r: InvestigationRequest): InvestigationRequest => ({
  region_id: r.region_id,
  start_year: r.start_year,
  end_year: r.end_year,
})

export const api = {
  health: () => request<{ status: string; regions_with_data: string[]; is_mock: boolean }>('/health'),
  regions: () => request<RegionsResponse>('/regions'),
  rainfallSeries: (req: InvestigationRequest) => cachedPost<RainfallSeriesResponse>('/rainfall/series', investigation(req)),
  trends: (req: InvestigationRequest) => cachedPost<TrendsResponse>('/analysis/trends', investigation(req)),
  spatial: (req: InvestigationRequest) => cachedPost<SpatialResponse>('/analysis/spatial', investigation(req)),
  history: (limit = 10) => request<InvestigationLog[]>(`/analysis/history?limit=${limit}`),
  interpret: (req: InvestigationRequest & { use_llm?: boolean }) =>
    cachedPost<InterpretResponse>('/ai/interpret', { ...investigation(req), use_llm: !!req.use_llm }),
  ask: (req: AskRequest) => post<AskResponse>('/ai/ask', { ...investigation(req), question: req.question, use_llm: !!req.use_llm }),
  clearCache: () => memo.clear(),
}
