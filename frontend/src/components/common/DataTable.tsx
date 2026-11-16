import type { ReactNode } from 'react'

/** The numbers behind a chart or map, as a real table, folded away by default (task B5). */
export function DataTable({
  summary,
  caption,
  head,
  rows,
}: {
  summary: string
  caption: string
  head: ReactNode
  rows: ReactNode
}) {
  return (
    <details className="data">
      <summary>{summary}</summary>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={caption}>
        <table className="table">
          <caption>{caption}</caption>
          <thead>{head}</thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </details>
  )
}
