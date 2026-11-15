import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useInvestigation } from '../../hooks/useInvestigation'
import { InvestigationControls } from '../dashboard/InvestigationControls'
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
  // A rain drop in the three colours of the flag of Cameroon.
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="drop">
          <path d="M16 2C16 2 5 14.5 5 21a11 11 0 0 0 22 0C27 14.5 16 2 16 2z" />
        </clipPath>
      </defs>
      <g clipPath="url(#drop)">
        <rect x="0" y="0" width="12.3" height="32" fill="#007a5e" />
        <rect x="12.3" y="0" width="7.4" height="32" fill="#ce1126" />
        <rect x="19.7" y="0" width="12.3" height="32" fill="#fcd116" />
      </g>
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
      <a className="skip" href="#main">
        Skip to content
      </a>
      <MockBanner show={region?.access_method === 'mock'} />
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink to={{ pathname: '/', search }} className="brand" aria-label="MboaScope home">
            <BrandMark />
            MboaScope <span className="brand-tag">Rainfall trends in Cameroon</span>
          </NavLink>
          <nav className="topnav" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={{ pathname: item.to, search }} end={item.to === '/'} className="nav-link">
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      {pathname !== '/method' && (
        <div className="controls-bar">
          <div className="container">
            <InvestigationControls />
          </div>
        </div>
      )}
      <main id="main" ref={main} tabIndex={-1} className="container page" style={{ outline: 'none' }}>
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
