import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './api'

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
const fail = (status: number, detail: string) => Promise.resolve(new Response(JSON.stringify({ detail }), { status }))

describe('api client', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    api.clearCache()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts the investigation body to /api/analysis/trends', async () => {
    fetchMock.mockReturnValueOnce(ok({ headline: {} }))
    await api.trends({ region_id: 'garoua', start_year: 2001, end_year: 2025 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/analysis/trends')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ region_id: 'garoua', start_year: 2001, end_year: 2025 })
  })

  it('asks the server once for the same investigation', async () => {
    fetchMock.mockImplementation(() => ok({ headline: {} }))
    const req = { region_id: 'douala', start_year: 2001, end_year: 2025 }
    await Promise.all([api.trends(req), api.trends(req)])
    await api.trends(req)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await api.trends({ ...req, start_year: 2002 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not keep failed answers', async () => {
    fetchMock.mockReturnValueOnce(fail(500, 'boom')).mockReturnValueOnce(ok({ headline: {} }))
    const req = { region_id: 'douala', start_year: 2001, end_year: 2025 }
    await expect(api.trends(req)).rejects.toThrow('boom')
    await expect(api.trends(req)).resolves.toEqual({ headline: {} })
  })

  it('turns the API detail into an ApiError with its status', async () => {
    fetchMock.mockReturnValueOnce(fail(409, 'no data for bertoua'))
    const err = await api.trends({ region_id: 'bertoua', start_year: 2001, end_year: 2025 }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(409)
    expect(err.message).toBe('no data for bertoua')
  })

  it('reports an unreachable server as status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const err = await api.regions().catch((e) => e)
    expect(err.status).toBe(0)
  })

  it('never caches questions', async () => {
    fetchMock.mockImplementation(() => ok({ answer: {} }))
    const req = { region_id: 'douala', start_year: 2001, end_year: 2025, question: 'Is it wetter?' }
    await api.ask(req)
    await api.ask(req)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ...req, use_llm: false })
  })
})
