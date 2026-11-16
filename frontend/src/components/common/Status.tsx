import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FIRST_YEAR, LAST_YEAR, MIN_YEARS, useInvestigation } from '../../hooks/useInvestigation'
import { IconAlert, IconCalendar, IconInfo, IconOffline } from './Icons'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> {label}
    </div>
  )
}

/** Grey placeholder with the shape of what is coming, plus a status message for screen readers. */
export function Skeleton({ kind, label }: { kind: 'answer' | 'chart'; label: string }) {
  return (
    <div role="status" aria-live="polite">
      <div className={`skeleton skeleton-${kind}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function StateMessage({
  title,
  children,
  tone = 'info',
  icon,
  actions,
}: {
  title: string
  children?: ReactNode
  tone?: 'info' | 'error'
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className={`state ${tone === 'error' ? 'state-error' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="state-icon">{icon ?? (tone === 'error' ? <IconAlert /> : <IconInfo />)}</span>
      <h2>{title}</h2>
      {children}
      {actions && <div className="state-actions">{actions}</div>}
    </section>
  )
}

/** Kept for small inline errors inside a card. */
export function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="inline-error" role="alert">
      {message}
    </p>
  )
}

/** A designed message for every error the API can return (docs/api.md, "Errors"). */
export function ApiProblem({ status, message, onRetry }: { status: number | null; message: string; onRetry?: () => void }) {
  const { region, regions, setRequest } = useInvestigation()
  const firstWithData = regions.find((r) => r.has_data && r.id !== region?.id)
  const retry = onRetry && (
    <button type="button" className="btn btn-primary" onClick={onRetry}>
      Try again
    </button>
  )

  if (status === 0) {
    return (
      <StateMessage tone="error" icon={<IconOffline />} title="The server cannot be reached" actions={retry}>
        <p>Check your connection. If you run MboaScope locally, start the backend first (see README).</p>
      </StateMessage>
    )
  }
  if (status === 409) {
    return (
      <StateMessage
        title={`No rainfall data for ${region?.name ?? 'this region'} yet`}
        actions={
          firstWithData && (
            <button type="button" className="btn btn-primary" onClick={() => setRequest({ region_id: firstWithData.id })}>
              Show {firstWithData.name} instead
            </button>
          )
        }
      >
        <p>The satellite data for this region has not been loaded. Choose another region in the list above.</p>
      </StateMessage>
    )
  }
  if (status === 404) {
    return (
      <StateMessage
        title="Unknown region"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setRequest({ region_id: 'douala' })}>
            Go to Douala
          </button>
        }
      >
        <p>The link points to a region MboaScope does not know. Choose one of the ten study regions.</p>
      </StateMessage>
    )
  }
  if (status === 422) {
    return (
      <StateMessage
        icon={<IconCalendar />}
        title="Not enough complete years in this period"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setRequest({ start_year: FIRST_YEAR, end_year: LAST_YEAR })}>
            Use {FIRST_YEAR} to {LAST_YEAR}
          </button>
        }
      >
        <p>The tests need at least {MIN_YEARS} complete years. Server message: {message}</p>
      </StateMessage>
    )
  }
  return (
    <StateMessage tone="error" title="Something went wrong" actions={retry}>
      <p>{message}</p>
    </StateMessage>
  )
}

/** Shown instead of a page when the chosen period is shorter than the tests accept. */
export function PeriodProblem() {
  const { request, setRequest } = useInvestigation()
  const backwards = request.end_year < request.start_year
  return (
    <StateMessage
      icon={<IconCalendar />}
      title={backwards ? 'The period runs backwards' : `Choose at least ${MIN_YEARS} years`}
      actions={
        <button type="button" className="btn btn-primary" onClick={() => setRequest({ start_year: FIRST_YEAR, end_year: LAST_YEAR })}>
          Use {FIRST_YEAR} to {LAST_YEAR}
        </button>
      }
    >
      <p>
        {backwards
          ? `"From" (${request.start_year}) is after "To" (${request.end_year}).`
          : `${request.start_year} to ${request.end_year} is ${request.end_year - request.start_year + 1} years.`}{' '}
        A trend test on fewer than {MIN_YEARS} yearly values is not meaningful.
      </p>
    </StateMessage>
  )
}

export function NotFound() {
  const { search } = useLocation()
  return (
    <StateMessage
      title="Page not found"
      actions={
        <Link className="btn btn-primary" to={{ pathname: '/', search }}>
          Back to the dashboard
        </Link>
      }
    />
  )
}
