import { useEffect, useRef } from 'react'

/** Decorative night sky behind every page: drifting aurora ribbons and twinkling stars. */
export function Backdrop() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    // Fixed seed: the same sky on every visit.
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const stars = Array.from({ length: 170 }, () => ({
      x: rand(),
      y: rand(),
      r: 0.3 + rand() * 1.1,
      phase: rand() * Math.PI * 2,
      speed: 0.4 + rand() * 1.4,
    }))
    let frame = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      el.width = window.innerWidth * dpr
      el.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const draw = (t: number) => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        const a = still ? 0.6 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase + (t / 1000) * s.speed))
        ctx.globalAlpha = a
        ctx.fillStyle = '#e8fff5'
        ctx.beginPath()
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!still) frame = requestAnimationFrame(draw)
    }
    resize()
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <canvas ref={canvas} className="stars" />
      <div className="vignette" />
    </div>
  )
}
