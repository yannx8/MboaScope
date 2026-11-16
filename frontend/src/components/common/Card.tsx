import { useId, type ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  children,
  action,
  fill = false,
}: {
  title?: string
  subtitle?: ReactNode
  children: ReactNode
  action?: ReactNode
  fill?: boolean
}) {
  const id = useId()
  return (
    <section className={`card${fill ? ' card-fill' : ''}`} aria-labelledby={title ? id : undefined}>
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h2 id={id}>{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  )
}
