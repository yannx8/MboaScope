import { VERDICT_SHORT, VERDICT_TONE } from '../../services/format'
import type { Verdict } from '../../types/api'
import { IconDown, IconFlat, IconUp } from './Icons'

/** Verdict as a coloured label. The words carry the meaning; colour and icon only repeat it. */
export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const tone = VERDICT_TONE[verdict]
  return (
    <span className={`chip chip-${tone}`}>
      {tone === 'wetter' ? <IconUp /> : tone === 'drier' ? <IconDown /> : <IconFlat />}
      {VERDICT_SHORT[verdict]}
    </span>
  )
}
