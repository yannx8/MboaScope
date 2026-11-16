import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

// CI runners can be slow: give async queries 3 s instead of 1 s.
configure({ asyncUtilTimeout: 3000 })

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom does not have.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
window.scrollTo = () => {}
