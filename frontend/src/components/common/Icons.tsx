// Small inline stroke icons. Decorative: always aria-hidden.
import type { ReactNode, SVGProps } from 'react'

function Svg({ children, ...rest }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  )
}

export const IconHome = () => (
  <Svg><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></Svg>
)
export const IconMap = () => (
  <Svg><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></Svg>
)
export const IconChart = () => (
  <Svg><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>
)
export const IconChat = () => (
  <Svg><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></Svg>
)
export const IconBook = () => (
  <Svg><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 5v16" /></Svg>
)
export const IconUp = () => (
  <Svg><path d="M7 17L17 7M9 7h8v8" /></Svg>
)
export const IconDown = () => (
  <Svg><path d="M7 7l10 10M17 9v8H9" /></Svg>
)
export const IconFlat = () => (
  <Svg><path d="M4 12h16M15 7l5 5-5 5" /></Svg>
)
export const IconSatellite = () => (
  <Svg><path d="M13 7l4 4M6 14l4 4M9 11l4 4M4 20l3-3" /><path d="M15 3l6 6-3 3-6-6z" /></Svg>
)
export const IconCoast = () => (
  <Svg><path d="M2 16c2 0 2-1.5 4-1.5S8 16 10 16s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 20c2 0 2-1.5 4-1.5S8 20 10 20s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" /><path d="M12 12V4l5 3-5 3" /></Svg>
)
export const IconRuler = () => (
  <Svg><path d="M3 17L17 3l4 4L7 21z" /><path d="M7 13l2 2M10 10l2 2M13 7l2 2" /></Svg>
)
export const IconGrid = () => (
  <Svg><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" /></Svg>
)
export const IconAlert = () => (
  <Svg><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></Svg>
)
export const IconInfo = () => (
  <Svg><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></Svg>
)
export const IconOffline = () => (
  <Svg><path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.5 5M5 12.6a10 10 0 0 1 4-2M19 12.6a10 10 0 0 0-3-1.8M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" /></Svg>
)
export const IconCalendar = () => (
  <Svg><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>
)
