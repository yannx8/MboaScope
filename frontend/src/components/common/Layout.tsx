import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useInvestigation } from '../../hooks/useInvestigation'
import { InvestigationControls } from '../dashboard/InvestigationControls'
import { Backdrop } from './Backdrop'
import { IconBook, IconChart, IconChat, IconHome, IconMap } from './Icons'
import { MockBanner } from './MockBanner'

export const NAV = [
  { to: '/', label: 'Dashboard', short: 'Answer', icon: IconHome, title: 'Dashboard' },
  { to: '/explorer', label: 'Explorer', short: 'Map', icon: IconMap, title: 'Explorer' },
  { to: '/analysis', label: 'Analysis', short: 'Analysis', icon: IconChart, title: 'Analysis' },
  { to: '/assistant', label: 'Assistant', short: 'Explain', icon: IconChat, title: 'Assistant' },
  { to: '/method', label: 'Method', short: 'Method', icon: IconBook, title: 'Method' },
]

export function BrandMark() {
  // A rain drop seen through a scope ring, with a satellite on its orbit:
  // satellite rainfall, looked at closely. Aurora palette, no flag colours.
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bm-drop" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#c8fbe6" />
          <stop offset="0.45" stopColor="#5fdcb0" />
          <stop offset="1" stopColor="#2f7fd0" />
        </linearGradient>
        <linearGradient id="bm-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9ff0cf" />
          <stop offset="1" stopColor="#7fb2ea" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="21" rx="17.5" ry="7.5" transform="rotate(-24 20 21)" fill="none" stroke="url(#bm-ring)" strokeWidth="1.4" opacity="0.85" />
      <path d="M20 5.5c0 0-8.5 9.6-8.5 15.4a8.5 8.5 0 0 0 17 0C28.5 15.1 20 5.5 20 5.5z" fill="url(#bm-drop)" />
      <path d="M14.6 22.6l2.7-2.6 2.7 2.6 2.7-2.6 2.7 2.6" fill="none" stroke="#04241b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.4 13.2c-1.2 1.7-2 3.3-2.3 4.6" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4.6 28.6a17.5 7.5 -24 0 0 7.2 1.6" fill="none" stroke="#9ff0cf" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="34.6" cy="12.6" r="2.1" fill="#eafff6" />
      <circle cx="34.6" cy="12.6" r="3.6" fill="#9ff0cf" opacity="0.25" />
    </svg>
  )
}

export function Layout() {
  const { region } = useInvestigation()
  const { search, pathname } = useLocation() // keep ?region=&from=&to= when switching pages
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)

  // Page title per route, and focus on the content after navigation for screen reader users.
  useEffect(() => {
    const item = NAV.find((n) => n.to === pathname) ?? NAV[0]
    document.title = `${item.title}${region ? ` · ${region.name}` : ''} · MboaScope`
  }, [pathname, region])
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    main.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <>
      <Backdrop />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <MockBanner show={region?.access_method === 'mock'} />
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink to={{ pathname: '/', search }} className="brand" aria-label="MboaScope home">
            <BrandMark />
            <span className="brand-word">Mboa<span>Scope</span></span> <span className="brand-tag">Rainfall trends in Cameroon</span>
          </NavLink>
          <nav className="topnav" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={{ pathname: item.to, search }} end={item.to === '/'} className="nav-link">
                {item.label}
              </NavLink>
            ))}
          </nav>
          <span className="topbar-chip" aria-live="polite">
            <span className="live-dot" aria-hidden="true" />
            {region?.name ?? 'Cameroon'}
          </span>
        </div>
      </header>
      {/* The dashboard shows the controls under its hero instead. */}
      {pathname !== '/method' && pathname !== '/' && (
        <div className="controls-bar">
          <div className="container">
            <InvestigationControls />
          </div>
        </div>
      )}
      <main id="main" ref={main} tabIndex={-1} className={`container page${pathname === '/' ? ' page-home' : ''}`} style={{ outline: 'none' }}>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <p>
            Rainfall: NASA GPM IMERG Final, monthly, V07 (GPM_3IMERGM),{' '}
            <a href="https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07">doi:10.5067/GPM/IMERG/3B-MONTH/07</a>. Satellite estimates
            averaged over an area, not station measurements. The results describe the past record only.
          </p>
          <nav className="footer-links" aria-label="Footer">
            <NavLink to={{ pathname: '/method', search }}>How MboaScope works (method)</NavLink>
            <a href="https://gpm.nasa.gov/data/imerg">About IMERG</a>
          </nav>
        </div>
      </footer>
      <nav className="tabbar" aria-label="Main (mobile)">
        {NAV.map(({ to, short, icon: Icon }) => (
          <NavLink key={to} to={{ pathname: to, search }} end={to === '/'} className="tab">
            <Icon />
            {short}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
