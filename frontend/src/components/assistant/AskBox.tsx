import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useInvestigation } from '../../hooks/useInvestigation'
import { api, ApiError } from '../../services/api'
import type { AskResponse } from '../../types/api'

const EXAMPLES = [
  'Is it getting wetter?',
  'How big is the change per year?',
  'Is the result significant?',
  'Did the 2014 satellite change matter?',
  'Why is this happening?',
]

/**
 * Free-text questions (task B9). The backend answers only from the computed analysis,
 * checks every answer, and refuses anything else. This component only displays.
 */
export function AskBox({ useLlm }: { useLlm: boolean }) {
  const { request, region } = useInvestigation()
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<(AskResponse & { id: number })[]>([])
  const nextId = useRef(0)
  // Answers belong to one investigation. A new region or period starts a new conversation,
  // and an answer that arrives after the switch is dropped.
  const scope = `${request.region_id}|${request.start_year}|${request.end_year}`
  const scopeRef = useRef(scope)
  useEffect(() => {
    scopeRef.current = scope
    setLog([])
    setError(null)
    setBusy(false)
  }, [scope])

  async function ask(q: string) {
    const text = q.trim()
    if (text.length < 3 || busy) return
    const asked = scope
    setBusy(true)
    setError(null)
    try {
      const res = await api.ask({ ...request, question: text, use_llm: useLlm })
      if (scopeRef.current !== asked) return
      setLog((items) => [{ ...res, id: nextId.current++ }, ...items].slice(0, 6))
      setQuestion('')
    } catch (err) {
      if (scopeRef.current !== asked) return
      setError(err instanceof ApiError && err.status === 0 ? 'The server cannot be reached.' : (err as Error).message)
    } finally {
      if (scopeRef.current === asked) setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void ask(question)
  }

  return (
    <div>
      <form className="ask-form" onSubmit={submit} aria-label="Ask about this result">
        <label htmlFor="ask-input" className="muted">
          Ask about the result for {region?.name ?? 'this region'}, {request.start_year} to {request.end_year}
        </label>
        <div className="ask-row">
          <input
            id="ask-input"
            type="text"
            value={question}
            maxLength={300}
            placeholder="Is it getting wetter?"
            onChange={(e) => setQuestion(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary" disabled={busy || question.trim().length < 3}>
            {busy ? 'Checking…' : 'Ask'}
          </button>
        </div>
        <div className="examples" aria-label="Example questions">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" className="example" onClick={() => void ask(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>
      </form>
      <div aria-live="polite">
        {error && (
          <p className="inline-error" role="alert" style={{ marginTop: '0.75rem' }}>
            {error}
          </p>
        )}
        {log.length > 0 && (
          <ul className="qa-list">
            {log.map((item) => (
              <li key={item.id}>
                <p className="qa-q">{item.question}</p>
                <div className={`qa-a${item.answer.answered ? '' : ' refusal'}`}>{item.answer.text}</div>
                <p className="small qa-meta">
                  {item.answer.source === 'gemini'
                    ? `Worded by ${item.answer.model}, checked against the analysis`
                    : item.answer.source === 'rules'
                      ? 'Built from the checked explanation'
                      : 'Refused: outside the computed results'}
                  {item.notes.length > 0 && `. ${item.notes[0]}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
