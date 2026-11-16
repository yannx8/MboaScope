// Method page (task B6). The text comes from docs/methodology.md at build time, so the page
// and the methodology can never disagree. Sections shown: 8 (plain-language method),
// 6 (known threats) and 9 (what the AI does).
import methodology from '../../../docs/methodology.md?raw'
import { Card } from '../components/common/Card'
import { Markdown, sections } from '../services/markdown'

const SHOWN = [
  { number: '8', id: 'method', title: 'How the answer is computed' },
  { number: '6', id: 'threats', title: 'Known problems with the data' },
  { number: '9', id: 'ai', title: 'What the AI does and does not do' },
]

export default function Method() {
  const all = sections(methodology)
  const parts = SHOWN.map((s) => ({ ...s, section: all.find((x) => x.number === s.number) })).filter((s) => s.section)

  return (
    <div className="grid">
      <div className="span-8 stack">
        <section className="answer" aria-labelledby="method-title">
          <h1 id="method-title" className="answer-verdict" style={{ fontSize: 'var(--fs-2xl)' }}>
            How MboaScope works
          </h1>
          <p className="answer-plain">
            MboaScope answers one question: has rainfall increased or decreased over time in a region of Cameroon, and is that trend
            statistically significant? It uses NASA satellite rainfall estimates and standard trend tests. It describes the past
            record only.
          </p>
        </section>
        {parts.map(({ id, title, section }) => (
          <Card key={id}>
            <div className="prose" id={id}>
              <h2>{title}</h2>
              <Markdown body={section!.body} />
            </div>
          </Card>
        ))}
      </div>
      <div className="span-4">
        <Card title="On this page">
          <ul className="toc">
            {parts.map((p) => (
              <li key={p.id}>
                <a href={`#${p.id}`}>{p.title}</a>
              </li>
            ))}
          </ul>
          <h3>Data</h3>
          <p className="muted">
            GPM IMERG Final, monthly, Version 07 (GPM_3IMERGM), NASA GES DISC.{' '}
            <a href="https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07">doi:10.5067/GPM/IMERG/3B-MONTH/07</a>
          </p>
          <h3>Source code and full methodology</h3>
          <p className="muted">
            This page is generated from <code>docs/methodology.md</code> in the project repository, which also lists the allowed and
            banned wording.
          </p>
        </Card>
      </div>
    </div>
  )
}
