import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/common/Layout'
import { NotFound, Skeleton } from './components/common/Status'
import { InvestigationProvider } from './hooks/useInvestigation'
import Dashboard from './pages/Dashboard'

// Leaflet, Recharts-heavy pages and the Method text load on demand so the dashboard answer appears first.
const Explorer = lazy(() => import('./pages/Explorer'))
const Analysis = lazy(() => import('./pages/Analysis'))
const Assistant = lazy(() => import('./pages/Assistant'))
const Method = lazy(() => import('./pages/Method'))

// GitHub Pages serves the app under /<repository>/; Vite passes that prefix as BASE_URL.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <BrowserRouter basename={basename || undefined}>
      <InvestigationProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="explorer" element={<Page><Explorer /></Page>} />
            <Route path="analysis" element={<Page><Analysis /></Page>} />
            <Route path="assistant" element={<Page><Assistant /></Page>} />
            <Route path="method" element={<Page><Method /></Page>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </InvestigationProvider>
    </BrowserRouter>
  )
}

/** Suspense inside the layout, so the header and controls stay put while a page loads. */
function Page({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Skeleton kind="chart" label="Loading the page…" />}>{children}</Suspense>
}
