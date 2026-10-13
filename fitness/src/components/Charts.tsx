import { useId, useMemo, useState, type ReactNode } from 'react'
import { cx } from './ui'

/**
 * Small, dependency-free SVG charts. Every point comes from saved data; the charts
 * render an explicit empty state rather than placeholder values.
 */

export interface Point {
  x: string // label (e.g. a date)
  y: number
  marker?: boolean // e.g. a variation change or PR
  note?: string
}

const W = 340

function niceMax(v: number) {
  if (v <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(v))
  const n = v / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag
}

export function LineChart({
  points,
  height = 160,
  color = 'var(--accent-fg)',
  format = (v: number) => String(Math.round(v)),
  invert = false,
  empty,
  ariaLabel,
}: {
  points: Point[]
  height?: number
  color?: string
  format?: (v: number) => string
  /** For pace: lower is better, so draw improvements upwards. */
  invert?: boolean
  empty?: ReactNode
  ariaLabel: string
}) {
  const gid = useId().replace(/:/g, '')
  const [active, setActive] = useState<number | null>(null)
  const layout = useMemo(() => {
    if (points.length === 0) return null
    const ys = points.map((p) => p.y)
    let lo = Math.min(...ys)
    let hi = Math.max(...ys)
    if (lo === hi) {
      lo = lo * 0.9
      hi = hi * 1.1 || 1
    }
    const pad = (hi - lo) * 0.15
    lo = Math.max(0, lo - pad)
    hi = hi + pad
    const top = 14
    const bottom = height - 24
    const left = 8
    const right = W - 8
    const sx = (i: number) => (points.length === 1 ? (left + right) / 2 : left + (i / (points.length - 1)) * (right - left))
    const sy = (v: number) => {
      const t = (v - lo) / (hi - lo)
      return invert ? top + t * (bottom - top) : bottom - t * (bottom - top)
    }
    const xy = points.map((p, i) => [sx(i), sy(p.y)] as const)
    const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const area = `${path} L${xy.at(-1)![0].toFixed(1)},${bottom} L${xy[0][0].toFixed(1)},${bottom} Z`
    return { xy, path, area, bottom, lo, hi }
  }, [points, height, invert])

  if (!layout) return <div className="h-[120px] grid place-items-center text-center text-[14px] text-muted px-6">{empty ?? 'No data yet'}</div>
  const sel = active ?? points.length - 1
  const labelEvery = Math.max(1, Math.ceil(points.length / 5))
  return (
    <div>
      <div className="flex items-baseline justify-between px-1 mb-1 min-h-[22px]">
        <span className="num text-[15px] font-semibold">{format(points[sel].y)}</span>
        <span className="text-[12.5px] text-muted">{points[sel].note ?? points[sel].x}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full touch-pan-y"
        role="img"
        aria-label={ariaLabel}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const x = ((e.clientX - r.left) / r.width) * W
          let best = 0
          layout.xy.forEach(([px], i) => Math.abs(px - x) < Math.abs(layout.xy[best][0] - x) && (best = i))
          setActive(best)
        }}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1="8" x2={W - 8} y1={14 + t * (layout.bottom - 14)} y2={14 + t * (layout.bottom - 14)} stroke="var(--line)" strokeDasharray="2 4" />
        ))}
        <line x1="8" x2={W - 8} y1={layout.bottom} y2={layout.bottom} stroke="var(--line-strong)" />
        {points.length > 1 && <path d={layout.area} fill={`url(#${gid})`} />}
        <path d={layout.path} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {layout.xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === sel ? 5 : points[i].marker ? 4 : 2.6} fill={i === sel || points[i].marker ? color : 'var(--surface)'} stroke={color} strokeWidth="2" />
        ))}
        <line x1={layout.xy[sel][0]} x2={layout.xy[sel][0]} y1="10" y2={layout.bottom} stroke={color} strokeOpacity="0.25" />
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={i} x={layout.xy[i][0]} y={height - 6} fontSize="10.5" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fill="var(--faint)">
              {p.x}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}

export function BarChart({
  bars,
  height = 150,
  format = (v: number) => String(Math.round(v)),
  color = 'var(--accent)',
  highlightLast = true,
  ariaLabel,
  goal,
}: {
  bars: { label: string; value: number; note?: string }[]
  height?: number
  format?: (v: number) => string
  color?: string
  highlightLast?: boolean
  ariaLabel: string
  goal?: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const max = niceMax(Math.max(...bars.map((b) => b.value), goal ?? 0, 1))
  const top = 10
  const bottom = height - 22
  const slot = (W - 16) / bars.length
  const bw = Math.min(26, slot * 0.58)
  const sel = active ?? bars.length - 1
  const allZero = bars.every((b) => b.value === 0)
  return (
    <div>
      <div className="flex items-baseline justify-between px-1 mb-1 min-h-[22px]">
        <span className="num text-[15px] font-semibold">{format(bars[sel]?.value ?? 0)}</span>
        <span className="text-[12.5px] text-muted">{bars[sel]?.note ?? bars[sel]?.label}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        <line x1="8" x2={W - 8} y1={bottom} y2={bottom} stroke="var(--line-strong)" />
        {goal !== undefined && goal > 0 && (
          <>
            <line x1="8" x2={W - 8} y1={bottom - (goal / max) * (bottom - top)} y2={bottom - (goal / max) * (bottom - top)} stroke="var(--muted)" strokeDasharray="3 4" />
          </>
        )}
        {bars.map((b, i) => {
          const h = (b.value / max) * (bottom - top)
          const x = 8 + slot * i + (slot - bw) / 2
          const on = i === sel
          return (
            <g key={i} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}>
              <rect x={8 + slot * i} y={top} width={slot} height={bottom - top + 20} fill="transparent" />
              <rect x={x} y={bottom - Math.max(h, b.value > 0 ? 3 : 0)} width={bw} height={Math.max(h, b.value > 0 ? 3 : 0)} rx={Math.min(6, bw / 3)} fill={color} opacity={on || (highlightLast && active === null && i === bars.length - 1) ? 1 : 0.38} />
              <text x={x + bw / 2} y={height - 6} fontSize="10.5" textAnchor="middle" fill={on ? 'var(--ink)' : 'var(--faint)'}>
                {b.label}
              </text>
            </g>
          )
        })}
      </svg>
      {allZero && <p className="text-center text-[13px] text-muted -mt-1">Nothing logged in this period yet.</p>}
    </div>
  )
}

/** Tiny inline trend line for list rows. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const r = hi - lo || 1
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 60).toFixed(1)},${(18 - ((v - lo) / r) * 16).toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 60 20" className={cx('w-[60px] h-[20px]', className)} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--accent-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
