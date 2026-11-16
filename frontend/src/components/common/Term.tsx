import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { GLOSSARY, type TermId } from '../../services/glossary'

/**
 * A statistical term with its plain-language definition.
 * Opens on hover, keyboard focus or tap; Escape or a tap elsewhere closes it.
 * Screen readers hear the definition as the button's description.
 */
export function Term({ id, children }: { id: TermId; children?: ReactNode }) {
  const entry = GLOSSARY[id]
  const tipId = useId()
  const wrap = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [alignRight, setAlignRight] = useState(false)

  const show = () => {
    const rect = wrap.current?.getBoundingClientRect()
    setAlignRight(!!rect && rect.left + 300 > window.innerWidth)
    setOpen(true)
  }
  const hide = () => {
    if (!pinned) setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setOpen(false)
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setPinned(false)
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <span className="term" ref={wrap} onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        className="term-button"
        aria-describedby={tipId}
        aria-expanded={open}
        onFocus={show}
        onBlur={() => {
          setPinned(false)
          setOpen(false)
        }}
        onClick={() => {
          if (pinned) {
            setPinned(false)
            setOpen(false)
          } else {
            setPinned(true)
            show()
          }
        }}
      >
        {children ?? entry.title}
      </button>
      <span id={tipId} role="tooltip" className={`term-tip${alignRight ? ' term-tip-right' : ''}`} hidden={!open}>
        <strong>{entry.title}.</strong> {entry.text}
      </span>
    </span>
  )
}
