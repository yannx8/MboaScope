import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../services/api'

export interface ApiState<T> {
  data: T | null
  error: string | null
  /** HTTP status of the error: 0 = server unreachable, 404, 409, 422, ... */
  status: number | null
  loading: boolean
  /** Forget cached answers and ask again. */
  reload: () => void
}

/** Run an API call whenever `deps` change; ignore answers that arrive after a newer request. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): ApiState<T> {
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<Omit<ApiState<T>, 'reload'>>({ data: null, error: null, status: null, loading: enabled })

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, status: null, loading: false })
      return
    }
    let current = true
    // Drop the previous answer: it belongs to another region or period and must never show under this one.
    setState({ data: null, error: null, status: null, loading: true })
    fn()
      .then((data) => current && setState({ data, error: null, status: null, loading: false }))
      .catch((err: Error) =>
        current &&
        setState({ data: null, error: err.message, status: err instanceof ApiError ? err.status : -1, loading: false }),
      )
    return () => {
      current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps])

  const reload = useCallback(() => {
    api.clearCache()
    setNonce((n) => n + 1)
  }, [])

  return { ...state, reload }
}
