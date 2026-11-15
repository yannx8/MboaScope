// A very small Markdown reader for docs/methodology.md: headings, paragraphs, lists,
// **bold**, `code` and [links](url). Builds React elements, never raw HTML.
import { Fragment, type ReactNode } from 'react'

export interface Section {
  number: string
  title: string
  body: string
}

/** Split a Markdown file into its "## N. Title" sections. */
export function sections(md: string): Section[] {
  const out: Section[] = []
  const re = /^## (\d+)\.\s+(.+)$/gm
  const marks = [...md.matchAll(re)]
  marks.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < marks.length ? marks[i + 1].index : md.length
    out.push({
      number: m[1],
      title: m[2].replace(/\s*\(for the Method page\)\s*$/i, '').trim(),
      body: md.slice(start, end).trim(),
    })
  })
  return out
}

export function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] !== undefined) parts.push(<strong key={k++}>{m[1]}</strong>)
    else if (m[2] !== undefined) parts.push(<code key={k++}>{m[2]}</code>)
    else parts.push(<a key={k++} href={m[4]}>{m[3]}</a>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

type Block = { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: string[] } | { kind: 'h3'; text: string }

export function blocks(body: string): Block[] {
  const out: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) out.push({ kind: 'p', text: para.join(' ') })
    para = []
  }
  for (const raw of body.split('\n')) {
    const line = raw.trimEnd()
    const ul = line.match(/^[-*]\s+(.*)$/)
    const ol = line.match(/^\d+\.\s+(.*)$/)
    const h3 = line.match(/^###\s+(.*)$/)
    const prev = out[out.length - 1]
    if (!line.trim()) {
      flush()
    } else if (h3) {
      flush()
      out.push({ kind: 'h3', text: h3[1] })
    } else if (ul || ol) {
      flush()
      const kind = ul ? 'ul' : 'ol'
      const text = (ul ?? ol)![1]
      if (prev && prev.kind === kind && para.length === 0) prev.items.push(text)
      else out.push({ kind, items: [text] })
    } else if (/^\s+\S/.test(raw) && prev && (prev.kind === 'ul' || prev.kind === 'ol') && para.length === 0) {
      prev.items[prev.items.length - 1] += ' ' + line.trim() // continuation of a list item
    } else if (line.startsWith('|')) {
      continue // tables are not rendered on the Method page
    } else {
      para.push(line.trim())
    }
  }
  flush()
  return out
}

export function Markdown({ body }: { body: string }) {
  return (
    <>
      {blocks(body).map((b, i) => (
        <Fragment key={i}>
          {b.kind === 'p' && <p>{inline(b.text)}</p>}
          {b.kind === 'h3' && <h3>{inline(b.text)}</h3>}
          {b.kind === 'ul' && <ul>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>}
          {b.kind === 'ol' && <ol>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>}
        </Fragment>
      ))}
    </>
  )
}
