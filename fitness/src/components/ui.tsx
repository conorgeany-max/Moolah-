import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ───────────── Buttons ─────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'xl' | 'lg' | 'md' | 'sm'

const buttonVariant: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-95',
  secondary: 'bg-raised text-ink hover:bg-hover',
  ghost: 'bg-transparent text-ink hover:bg-raised',
  danger: 'bg-danger-soft text-danger hover:brightness-110',
  outline: 'bg-transparent text-ink border border-line-strong hover:bg-raised',
}
const buttonSize: Record<ButtonSize, string> = {
  xl: 'h-16 px-6 text-[17px] rounded-[18px] gap-2.5',
  lg: 'h-14 px-5 text-[16px] rounded-[16px] gap-2',
  md: 'h-12 px-4 text-[15px] rounded-[14px] gap-2',
  sm: 'h-9 px-3 text-[14px] rounded-[11px] gap-1.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; icon?: IconName; iconRight?: IconName; block?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'press inline-flex items-center justify-center font-semibold tracking-[-0.01em] select-none disabled:opacity-40 disabled:pointer-events-none',
        buttonVariant[variant],
        buttonSize[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} strokeWidth={2} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 20} strokeWidth={2} />}
    </button>
  )
}

export function IconButton({ icon, label, size = 44, variant = 'secondary', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number; variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('press inline-flex items-center justify-center rounded-full shrink-0 disabled:opacity-40', buttonVariant[variant], className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.46)} strokeWidth={2} />
    </button>
  )
}

// ───────────── Layout ─────────────

export function Card({ children, className, onClick, as = 'div', ...rest }: { children: ReactNode; className?: string; onClick?: () => void; as?: 'div' | 'section' | 'button' } & Record<string, unknown>) {
  const cls = cx('bg-surface border border-line rounded-[var(--radius-card)] shadow-card', onClick && 'press text-left w-full', className)
  if (onClick || as === 'button')
    return (
      <button type="button" className={cls} onClick={onClick} {...rest}>
        {children}
      </button>
    )
  const Tag = as
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  )
}

export function SectionHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-end justify-between px-1 mb-2.5', className)}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</h2>
      {action}
    </div>
  )
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press text-[14px] font-semibold text-accent-fg py-1">
      {children}
    </button>
  )
}

export function ListRow({
  icon,
  iconTone = 'neutral',
  title,
  subtitle,
  right,
  onClick,
  chevron = !!onClick,
  className,
}: {
  icon?: IconName
  iconTone?: Tone
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  onClick?: () => void
  chevron?: boolean
  className?: string
}) {
  const inner = (
    <>
      {icon && (
        <span className={cx('w-9 h-9 rounded-[11px] grid place-items-center shrink-0', toneBg[iconTone])}>
          <Icon name={icon} size={19} />
        </span>
      )}
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[16px] font-medium leading-tight truncate">{title}</span>
        {subtitle && <span className="block text-[13.5px] text-muted mt-0.5 leading-snug">{subtitle}</span>}
      </span>
      {right}
      {chevron && <Icon name="chevronRight" size={18} className="text-faint shrink-0" />}
    </>
  )
  const cls = cx('flex items-center gap-3 w-full min-h-[56px] px-4 py-2.5', className)
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, 'press hover:bg-raised')}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('bg-surface border border-line rounded-[var(--radius-card)] overflow-hidden divide-y divide-line', className)}>{children}</div>
}

// ───────────── Tones & badges ─────────────

export type Tone = 'neutral' | 'accent' | 'run' | 'calm' | 'warn' | 'danger'
export const toneBg: Record<Tone, string> = {
  neutral: 'bg-raised text-ink',
  accent: 'bg-accent-soft text-accent-fg',
  run: 'bg-run-soft text-run',
  calm: 'bg-calm-soft text-calm',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
}
export const toneText: Record<Tone, string> = {
  neutral: 'text-ink',
  accent: 'text-accent-fg',
  run: 'text-run',
  calm: 'text-calm',
  warn: 'text-warn',
  danger: 'text-danger',
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 h-6 px-2 rounded-full text-[12px] font-semibold whitespace-nowrap', toneBg[tone], className)}>{children}</span>
}

// ───────────── Form controls ─────────────

export function Chip({ selected, onClick, children, icon, className }: { selected: boolean; onClick: () => void; children: ReactNode; icon?: IconName; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'press inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full text-[15px] font-medium border',
        selected ? 'bg-accent text-accent-ink border-transparent' : 'bg-surface text-ink border-line-strong',
        className,
      )}
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
      {selected && <Icon name="check" size={16} strokeWidth={2.4} />}
    </button>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, size = 'md', className }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'md' | 'lg'; className?: string }) {
  return (
    <div role="radiogroup" className={cx('grid gap-1 p-1 rounded-[14px] bg-sunken border border-line', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'press rounded-[10px] font-semibold text-[14px] px-2 transition-colors',
            size === 'lg' ? 'h-12' : 'h-10',
            o.value === value ? 'bg-surface text-ink shadow-card border border-line' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, label, unit, size = 'md' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label?: string; unit?: string; size?: 'md' | 'xl' }) {
  const big = size === 'xl'
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <IconButton icon="minus" label={`Decrease ${label ?? ''}`} size={big ? 64 : 44} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} />
      <div className="flex-1 text-center" aria-live="polite">
        <span className={cx('num font-bold tracking-tight', big ? 'text-[64px] leading-none' : 'text-[28px]')}>{value}</span>
        {unit && <span className={cx('text-muted ml-1', big ? 'text-[18px]' : 'text-[15px]')}>{unit}</span>}
      </div>
      <IconButton icon="plus" label={`Increase ${label ?? ''}`} size={big ? 64 : 44} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} />
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex items-center gap-3 min-h-[56px] px-4 py-2.5 cursor-pointer">
      <span className="flex-1">
        <span className="block text-[16px] font-medium">{label}</span>
        {description && <span className="block text-[13.5px] text-muted mt-0.5 leading-snug">{description}</span>}
      </span>
      <span className="relative inline-block">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="block w-[51px] h-[31px] rounded-full bg-hover peer-checked:bg-accent transition-colors" />
        <span className="absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-[20px]" />
      </span>
    </label>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[14px] font-medium text-muted mb-1.5 px-1">{label}</span>
      {children}
      {hint && <span className="block text-[13px] text-faint mt-1.5 px-1">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full h-12 px-4 rounded-[14px] bg-sunken border border-line-strong text-ink placeholder:text-faint focus:outline-none focus:border-accent-fg'

export function NumberInput({ value, onChange, placeholder, suffix, min, max, step, inputMode = 'decimal', ariaLabel }: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string; suffix?: string; min?: number; max?: number; step?: number; inputMode?: 'decimal' | 'numeric'; ariaLabel?: string }) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  useEffect(() => {
    setText((t) => (Number(t) === value || (t === '' && value === undefined) ? t : value === undefined ? '' : String(value)))
  }, [value])
  return (
    <div className="relative">
      <input
        aria-label={ariaLabel}
        className={cx(inputCls, suffix && 'pr-14', 'num')}
        inputMode={inputMode}
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(',', '.')
          if (!/^\d*\.?\d*$/.test(raw)) return
          setText(raw)
          if (raw === '' || raw === '.') return onChange(undefined)
          let n = Number(raw)
          if (min !== undefined && n < min) n = min
          if (max !== undefined && n > max) n = max
          void step
          onChange(n)
        }}
      />
      {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-[15px] pointer-events-none">{suffix}</span>}
    </div>
  )
}

// ───────────── Progress ─────────────

export function ProgressBar({ value, tone = 'accent', className, label }: { value: number; tone?: 'accent' | 'run' | 'calm'; className?: string; label?: string }) {
  const color = tone === 'accent' ? 'bg-accent' : tone === 'run' ? 'bg-run' : 'bg-calm'
  return (
    <div className={cx('h-1.5 rounded-full bg-raised overflow-hidden', className)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

export function ProgressRing({ value, size = 64, stroke = 6, children, tone = 'accent', label }: { value: number; size?: number; stroke?: number; children?: ReactNode; tone?: 'accent' | 'run' | 'calm'; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  const color = tone === 'accent' ? 'var(--accent)' : tone === 'run' ? 'var(--run)' : 'var(--calm)'
  return (
    <div className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--raised)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 0.6s var(--ease-out-soft)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function Stat({ label, value, unit, sub, className }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className="text-[12.5px] font-medium text-muted uppercase tracking-[0.06em] truncate">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="num text-[26px] font-bold tracking-tight leading-none">{value}</span>
        {unit && <span className="text-[14px] text-muted">{unit}</span>}
      </div>
      {sub && <div className="text-[13px] text-muted mt-1">{sub}</div>}
    </div>
  )
}

// ───────────── States ─────────────

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 animate-fade">
      <span className="w-14 h-14 rounded-[18px] bg-raised grid place-items-center text-muted mb-4">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="text-[18px] font-semibold">{title}</h3>
      <p className="text-[15px] text-muted mt-1.5 max-w-[300px] leading-relaxed">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Notice({ tone = 'neutral', icon = 'info', title, children, action }: { tone?: Tone; icon?: IconName; title?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={cx('flex gap-3 p-4 rounded-[18px] border border-line', tone === 'neutral' ? 'bg-surface' : toneBg[tone])}>
      <Icon name={icon} size={20} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-[14.5px] leading-relaxed">
        {title && <div className="font-semibold mb-0.5 text-ink">{title}</div>}
        <div className={tone === 'neutral' ? 'text-muted' : 'text-ink/85'}>{children}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  )
}

// ───────────── Sheet (bottom modal) ─────────────

export function Sheet({ open, onClose, title, children, footer, tall }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="absolute inset-0 bg-[var(--overlay)] animate-fade" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={cx('relative w-full max-w-[520px] bg-surface border-t border-line rounded-t-[28px] animate-sheet flex flex-col outline-none', tall ? 'h-[92dvh]' : 'max-h-[88dvh]')}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1.5 rounded-full bg-line-strong" />
        </div>
        {title && (
          <div className="flex items-center gap-3 px-5 pt-1 pb-3">
            <h2 className="flex-1 text-[19px] font-bold tracking-tight">{title}</h2>
            <IconButton icon="x" label="Close" size={36} onClick={onClose} />
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="px-5 pt-3 pb-safe border-t border-line bg-surface">{footer}</div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>
  )
}

export function ConfirmSheet({ open, onClose, title, body, confirmLabel, onConfirm, danger }: { open: boolean; onClose: () => void; title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; danger?: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="text-[15px] text-muted leading-relaxed">{body}</div>
      <div className="grid gap-2 mt-6">
        <Button size="lg" variant={danger ? 'danger' : 'primary'} block onClick={() => (onConfirm(), onClose())}>
          {confirmLabel}
        </Button>
        <Button size="lg" variant="ghost" block onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  )
}

// ───────────── Toasts ─────────────

type ToastMsg = { id: number; text: string; tone: Tone }
let toastListeners: ((t: ToastMsg[]) => void)[] = []
let toasts: ToastMsg[] = []
export function toast(text: string, tone: Tone = 'neutral') {
  const t = { id: Date.now() + Math.random(), text, tone }
  toasts = [...toasts, t]
  toastListeners.forEach((l) => l(toasts))
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    toastListeners.forEach((l) => l(toasts))
  }, 3200)
}
export function Toaster() {
  const [list, setList] = useState<ToastMsg[]>([])
  useEffect(() => {
    toastListeners.push(setList)
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setList)
    }
  }, [])
  return (
    <div className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4" style={{ top: 'max(env(safe-area-inset-top), 12px)' }} aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={cx('animate-rise pointer-events-auto px-4 py-3 rounded-[16px] shadow-card border border-line text-[14.5px] font-medium max-w-[400px]', 'bg-raised', toneText[t.tone])}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded-[14px]', className)} />
}
