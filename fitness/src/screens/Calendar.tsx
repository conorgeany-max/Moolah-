import { useMemo, useState } from 'react'
import { DayPreview } from '../components/DayPreview'
import { Screen } from '../components/Layout'
import { KIND_META, SessionIcon } from '../components/Training'
import { Badge, Card, cx, IconButton, ListGroup, ListRow } from '../components/ui'
import { dayStatus, planFor, SESSION_INFO, type DayPlan } from '../engine/schedule'
import { addDays, dayKey, formatDay, mondayOf, parseDay, WEEKDAY_LETTER } from '../lib/date'
import { formatDuration } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { formatDistance } from '../lib/units'

const DOT: Record<string, string> = { accent: 'bg-accent', run: 'bg-run', warn: 'bg-warn', calm: 'bg-calm', neutral: 'bg-faint', danger: 'bg-danger' }

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function CalendarScreen() {
  const programme = useStore((s) => s.programme)
  const workouts = useStore((s) => s.workouts)
  const runs = useStore((s) => s.runs)
  const units = useStore((s) => s.profile?.units)
  const today = dayKey()
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [selected, setSelected] = useState(today)
  const [preview, setPreview] = useState<DayPlan | null>(null)

  const [y, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const daysInMonth = new Date(y, m, 0).getDate()
  const gridStart = mondayOf(first)
  const cells = useMemo(() => {
    const out: string[] = []
    let d = gridStart
    const last = `${month}-${String(daysInMonth).padStart(2, '0')}`
    while (out.length < 42 && (out.length % 7 !== 0 || d <= last)) {
      out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [gridStart, month, daysInMonth])

  const activity = useMemo(() => {
    const map = new Map<string, { workouts: typeof workouts; runs: typeof runs }>()
    for (const w of workouts) {
      if (w.status === 'active') continue
      const e = map.get(w.date) ?? { workouts: [], runs: [] }
      e.workouts.push(w)
      map.set(w.date, e)
    }
    for (const r of runs) {
      if (r.status !== 'completed') continue
      const e = map.get(r.date) ?? { workouts: [], runs: [] }
      e.runs.push(r)
      map.set(r.date, e)
    }
    return map
  }, [workouts, runs])

  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1)
    setMonth(monthKey(d))
  }

  const monthDone = cells.filter((d) => d.startsWith(month) && activity.has(d)).length
  const sel = programme ? planFor(programme, selected) : null
  const selStatus = sel ? dayStatus(sel, workouts, runs, today) : null
  const selActivity = activity.get(selected)

  return (
    <Screen title="Calendar" back="/train">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <IconButton icon="chevronLeft" label="Previous month" variant="ghost" size={40} onClick={() => shift(-1)} />
          <div className="text-center">
            <div className="font-semibold text-[17px]">{parseDay(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
            <div className="text-[12.5px] text-muted">{monthDone} active {monthDone === 1 ? 'day' : 'days'}</div>
          </div>
          <IconButton icon="chevronRight" label="Next month" variant="ghost" size={40} onClick={() => shift(1)} />
        </div>
        <div className="grid grid-cols-7 text-center text-[12px] text-faint font-semibold mb-1" aria-hidden="true">
          {WEEKDAY_LETTER.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1" role="grid" aria-label="Training calendar">
          {cells.map((d) => {
            const inMonth = d.startsWith(month)
            const plan = programme ? planFor(programme, d) : null
            const st = plan ? dayStatus(plan, workouts, runs, today) : null
            const act = activity.get(d)
            const planned = plan && plan.inProgramme && plan.type !== 'rest'
            const tone = planned ? KIND_META[SESSION_INFO[plan.type].kind].tone : 'neutral'
            const label = `${formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}${planned ? `, ${SESSION_INFO[plan!.type].label}` : ''}${st === 'done' || act ? ', completed' : st === 'missed' ? ', missed' : ''}`
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                aria-label={label}
                aria-selected={d === selected}
                onClick={() => setSelected(d)}
                className={cx(
                  'press relative h-12 rounded-[12px] flex flex-col items-center justify-center gap-1',
                  d === selected ? 'bg-raised ring-2 ring-accent' : '',
                  !inMonth && 'opacity-35',
                )}
              >
                <span
                  className={cx(
                    'num text-[14.5px] w-8 h-6 grid place-items-center rounded-full',
                    act || st === 'done' ? 'bg-accent text-accent-ink font-bold' : d === today ? 'font-bold text-accent-fg' : '',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                <span className="h-1.5 flex gap-0.5" aria-hidden="true">
                  {planned && <span className={cx('w-1.5 h-1.5 rounded-full', st === 'missed' ? 'bg-danger' : st === 'skipped' ? 'bg-faint' : DOT[tone])} />}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] text-muted">
          <Legend cls="bg-accent" label="Strength" />
          <Legend cls="bg-run" label="Run" />
          <Legend cls="bg-warn" label="Conditioning" />
          <Legend cls="bg-calm" label="Mobility" />
          <Legend cls="bg-danger" label="Missed" />
        </div>
      </Card>

      <section className="mt-5 space-y-3">
        <h2 className="text-[17px] font-semibold">{formatDay(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        {sel && sel.inProgramme && (
          <ListGroup>
            <button type="button" onClick={() => setPreview(sel)} className="press w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-raised">
              <SessionIcon type={sel.type} size={36} />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold">{SESSION_INFO[sel.type].label}</span>
                <span className="block text-[13px] text-muted">
                  Week {sel.week}
                  {sel.isDeload ? ' · deload' : ''}
                </span>
              </span>
              {selStatus === 'done' && <Badge tone="accent">Done</Badge>}
              {selStatus === 'missed' && <Badge tone="danger">Missed</Badge>}
              {selStatus === 'skipped' && <Badge>Skipped</Badge>}
              {selStatus === 'today' && <Badge tone="accent">Today</Badge>}
            </button>
          </ListGroup>
        )}
        {sel && !sel.inProgramme && <p className="text-[14px] text-muted">Outside your current programme.</p>}
        {selActivity && (
          <ListGroup>
            {selActivity.workouts.map((w) => (
              <ListRow key={w.id} icon="check" iconTone="accent" title={w.title} subtitle={`${w.status === 'ended' ? 'Ended early · ' : ''}${formatDuration(w.activeMs)}`} onClick={() => navigate(`/history/${w.id}`)} />
            ))}
            {selActivity.runs.map((r) => (
              <ListRow key={r.id} icon="run" iconTone="run" title={r.title} subtitle={`${r.distanceM && units ? formatDistance(r.distanceM, units) + ' · ' : ''}${formatDuration(r.activeMs)}`} onClick={() => navigate(`/run/${r.id}`)} />
            ))}
          </ListGroup>
        )}
        {!selActivity && selected <= today && sel?.type === 'rest' && <p className="text-[14px] text-muted">Rest day, nothing logged.</p>}
      </section>
      <DayPreview plan={preview} onClose={() => setPreview(null)} onMove={() => (setPreview(null), navigate('/plan'))} />
    </Screen>
  )
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx('w-2 h-2 rounded-full', cls)} />
      {label}
    </span>
  )
}
