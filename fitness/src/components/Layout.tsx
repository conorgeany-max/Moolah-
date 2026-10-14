import { useEffect, useState, type ReactNode } from 'react'
import { goBack, navigate, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import { formatDuration } from '../lib/format'
import { elapsedMs } from '../engine/steps'
import { useNow } from '../hooks/useNow'
import { Icon, type IconName } from './Icon'
import { cx, IconButton } from './ui'

export function Screen({
  title,
  eyebrow,
  back,
  actions,
  children,
  tabbar = true,
  className,
}: {
  title?: ReactNode
  eyebrow?: ReactNode
  /** Parent path for the back button; omit for top-level tabs. */
  back?: string
  actions?: ReactNode
  children: ReactNode
  tabbar?: boolean
  className?: string
}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className={cx('min-h-dvh', tabbar ? 'pb-tabbar' : 'pb-safe')}>
      <header
        className={cx(
          'sticky top-0 z-30 pt-safe transition-colors duration-200',
          scrolled ? 'bg-[color-mix(in_srgb,var(--canvas)_86%,transparent)] backdrop-blur-xl border-b border-line' : 'border-b border-transparent',
        )}
      >
        <div className="flex items-center gap-2 h-12 px-4 max-w-[560px] mx-auto">
          {back !== undefined ? (
            <IconButton icon="chevronLeft" label="Back" variant="ghost" size={40} className="-ml-2" onClick={() => goBack(back)} />
          ) : null}
          <div className={cx('flex-1 min-w-0 font-semibold text-[16px] truncate transition-opacity', scrolled || back !== undefined ? 'opacity-100' : 'opacity-0')}>{scrolled ? title : back !== undefined ? '' : ''}</div>
          {actions}
        </div>
      </header>
      <main className={cx('px-4 max-w-[560px] mx-auto', className)}>
        {(title || eyebrow) && (
          <div className="pt-1 pb-5 animate-rise">
            {eyebrow && <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">{eyebrow}</div>}
            {title && <h1 className="font-[family-name:var(--font-display)] text-[32px] leading-[1.08] font-bold tracking-[-0.025em]">{title}</h1>}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

const TABS: { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/train', label: 'Train', icon: 'bolt' },
  { path: '/progress', label: 'Progress', icon: 'chart' },
  { path: '/library', label: 'Library', icon: 'book' },
  { path: '/profile', label: 'Profile', icon: 'user' },
]

export function TabBar() {
  const { parts } = useRoute()
  const current = '/' + (parts[0] ?? '')
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ResumeBanner />
      <div className="grid grid-cols-5 max-w-[560px] mx-auto h-[60px]">
        {TABS.map((t) => {
          const active = current === t.path
          return (
            <button
              key={t.path}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(t.path)}
              className={cx('press flex flex-col items-center justify-center gap-1 text-[11px] font-semibold', active ? 'text-ink' : 'text-faint')}
            >
              <span className={cx('grid place-items-center w-12 h-7 rounded-full transition-colors', active && 'bg-accent-soft text-accent-fg')}>
                <Icon name={t.icon} size={21} strokeWidth={active ? 2.1 : 1.8} />
              </span>
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function ResumeBanner() {
  const workout = useStore((s) => s.workouts.find((w) => w.status === 'active'))
  const run = useStore((s) => s.runs.find((r) => r.status === 'active'))
  const live = workout ?? run
  const now = useNow(!!live, 1000)
  if (!live) return null
  const isRun = !workout
  return (
    <div className="max-w-[560px] mx-auto px-3 pt-2">
      <button
        type="button"
        onClick={() => navigate(isRun ? '/run' : '/workout')}
        className="press w-full flex items-center gap-3 h-12 px-4 rounded-[14px] bg-accent text-accent-ink font-semibold text-[15px]"
      >
        <span className="w-2 h-2 rounded-full bg-accent-ink animate-pulse-soft" />
        <span className="flex-1 text-left truncate">{isRun ? 'Run in progress' : workout!.title}</span>
        <span className="num">{formatDuration(elapsedMs(live, now))}</span>
        <Icon name="chevronRight" size={18} strokeWidth={2.2} />
      </button>
    </div>
  )
}
