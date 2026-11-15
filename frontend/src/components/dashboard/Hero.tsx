import type { CSSProperties, MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useInvestigation } from '../../hooks/useInvestigation'
import { Globe } from '../common/Globe'

const TITLE = ['Is', 'it', 'getting', 'wetter', 'in', 'Cameroon?']

const delay = (i: number) => ({ '--d': `${i * 90}ms` }) as CSSProperties

/** Opening screen of the dashboard. Text only; every number lives in the answer below. */
export function Hero() {
  const { regions, region, request } = useInvestigation()
  const { search } = useLocation()

  const toAnswer = (e: MouseEvent) => {
    e.preventDefault()
    const target = document.getElementById('answer')
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    target?.focus({ preventScroll: true })
  }

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-eyebrow reveal" style={delay(0)}>
          NASA satellite rainfall, tested
        </p>
        <h1 id="hero-title" className="hero-title">
          {TITLE.map((word, i) => (
            <span key={i} className="word" style={delay(i + 1)}>
              {word}{' '}
            </span>
          ))}
        </h1>
        <p className="hero-lead reveal" style={delay(8)}>
          MboaScope checks the satellite record for {regions.length ? `${regions.length} regional capitals` : 'the regional capitals'}{' '}
          and tells you whether annual rainfall rose or fell, how sure the test is, and what the numbers cannot say.
        </p>
        <div className="hero-actions reveal" style={delay(10)}>
          <a href="#answer" className="btn btn-glow" onClick={toAnswer}>
            See the answer{region ? ` for ${region.name}` : ''}
          </a>
          <Link className="btn btn-glass" to={{ pathname: '/method', search }}>
            How it works
          </Link>
        </div>
      </div>
      <div className="hero-globe reveal" style={delay(4)}>
        <Globe regions={regions} currentId={request.region_id} />
      </div>
      <a href="#answer" className="scroll-cue" onClick={toAnswer}>
        <span className="mouse" aria-hidden="true" />
        Explore
      </a>
    </section>
  )
}
