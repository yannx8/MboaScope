import type { ComponentType } from 'react'
import { CAVEAT_TEXT, CAVEAT_TITLE } from '../../services/format'
import { IconCoast, IconGrid, IconRuler, IconSatellite } from '../common/Icons'

const ICON: Record<string, ComponentType> = {
  sensor_change_2014: IconSatellite,
  coastal_skill: IconCoast,
  short_record: IconRuler,
  area_estimate: IconGrid,
}

/** The data threats the methodology says must be shown, never hidden (docs/methodology.md, section 6). */
export function CaveatList({ caveats }: { caveats: string[] }) {
  return (
    <ul className="caveats">
      {caveats.map((c) => {
        const Icon = ICON[c] ?? IconGrid
        return (
          <li key={c} className={c === 'sensor_change_2014' ? 'caveat-2014' : undefined}>
            <span className="caveat-icon"><Icon /></span>
            <div>
              <strong>{CAVEAT_TITLE[c] ?? c}</strong>
              {CAVEAT_TEXT[c] && <span>{CAVEAT_TEXT[c]}</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
