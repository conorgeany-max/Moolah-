import { useEffect, useState } from 'react'
import { DayPreview } from '../components/DayPreview'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Layout'
import { SessionIcon } from '../components/Training'
import { Badge, Button, Card, ConfirmSheet, cx, IconButton, ListGroup, ListRow, Notice, SectionHeader, Sheet, Stepper, toast } from '../components/ui'
import { TRACKS } from '../data/exercises'
import { availableTrack, ctxFromProfile, getExercise } from '../engine/library'
import { rangeFor } from '../engine/programme'
import { dayStatus, evaluateWeek, SESSION_INFO, weekPlan, type DayPlan, type LoadIssue } from '../engine/schedule'
import { applyMove, regenerateProgramme, saveProgramme } from '../lib/actions'
import { addDays, dayKey, diffDays, formatDay, mondayOf } from '../lib/date'
import { useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import type { SlotState } from '../lib/types'

export function PlanScreen() {
  const programme = useStore((s) => s.programme)
  const profile = useStore((s) => s.profile)
  const workouts = useStore((s) => s.workouts)
  const runs = useStore((s) => s.runs)
  const { query } = useRoute()
  const today = dayKey()
  const [monday, setMonday] = useState(mondayOf(today))
  const [moving, setMoving] = useState<DayPlan | null>(null)
  const [blocked, setBlocked] = useState<{ from: string; to: string; issues: LoadIssue[] } | null>(null)
  const [preview, setPreview] = useState<DayPlan | null>(null)
  const [editSlot, setEditSlot] = useState<SlotState | null>(null)
  const [confirm, setConfirm] = useState<'rebuild' | 'restart' | null>(null)

  useEffect(() => {
    if (query.get('section') === 'levels') document.getElementById('levels')?.scrollIntoView({ behavior: 'smooth' })
  }, [query])

  if (!programme || !profile) return null
  const week = weekPlan(programme, monday)
  const weekIssues = evaluateWeek(week.map((d) => (d.skipped ? 'rest' : d.type)), week.map((d) => d.lighten)).issues
  const lastMonday = addDays(programme.startDate, (programme.weeks - 1) * 7)

  const tryMove = (to: DayPlan) => {
    if (!moving) return
    const r = applyMove(moving.date, to.date, false)
    if (r.ok) {
      toast(`Moved ${SESSION_INFO[moving.type].short} to ${formatDay(to.date, { weekday: 'long' })}`, 'accent')
      setMoving(null)
    } else {
      setBlocked({ from: moving.date, to: to.date, issues: r.issues.filter((i) => i.severity === 'block') })
    }
  }

  return (
    <Screen back="/train" title="Manage plan">
      <div className="space-y-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <IconButton icon="chevronLeft" label="Previous week" size={40} onClick={() => setMonday(addDays(monday, -7))} disabled={diffDays(monday, programme.startDate) <= 0} />
            <div className="flex-1 text-center">
              <div className="font-semibold">{week[0].inProgramme ? `Week ${week[0].week}` : 'Outside programme'}</div>
              <div className="text-[13px] text-muted">
                {formatDay(monday, { day: 'numeric', month: 'short' })} – {formatDay(addDays(monday, 6), { day: 'numeric', month: 'short' })}
              </div>
            </div>
            <IconButton icon="chevronRight" label="Next week" size={40} onClick={() => setMonday(addDays(monday, 7))} disabled={diffDays(monday, lastMonday) >= 0} />
          </div>

          {moving && (
            <Notice tone="accent" icon="swap" title={`Move ${SESSION_INFO[moving.type].short}`} action={<Button size="sm" variant="secondary" onClick={() => setMoving(null)}>Cancel</Button>}>
              Tap the day you want it on. The sessions swap places, so the week keeps the same balance.
            </Notice>
          )}

          <ListGroup className={moving ? 'mt-3' : ''}>
            {week.map((d) => {
              const st = dayStatus(d, workouts, runs, today)
              const isPast = diffDays(d.date, today) < 0
              const selectable = moving && !isPast && d.date !== moving.date && st !== 'done'
              return (
                <div key={d.date} className={cx('flex items-center', selectable && 'bg-accent-soft', moving?.date === d.date && 'ring-2 ring-inset ring-accent-fg')}>
                  <button
                    type="button"
                    disabled={!!moving && !selectable}
                    onClick={() => (moving ? tryMove(d) : setPreview(d))}
                    className="press flex-1 min-w-0 flex items-center gap-3 pl-4 pr-2 py-3 text-left disabled:opacity-40"
                  >
                    <div className="w-11 text-center">
                      <div className="text-[12px] text-muted font-semibold">{formatDay(d.date, { weekday: 'short' })}</div>
                      <div className="num text-[18px] font-bold leading-tight">{formatDay(d.date, { day: 'numeric' })}</div>
                    </div>
                    <SessionIcon type={d.skipped ? 'rest' : d.type} size={34} />
                    <div className="flex-1 min-w-0">
                      <div className={cx('text-[15px] font-semibold truncate', d.skipped && 'line-through text-muted')}>{SESSION_INFO[d.type].label}</div>
                      <div className="flex gap-1 mt-0.5">
                        {d.isDeload && d.type !== 'rest' && <Badge tone="calm">Deload</Badge>}
                        {d.lighten && <Badge tone="calm">Lighter</Badge>}
                        {d.moved && <Badge>Moved</Badge>}
                        {st === 'done' && <Badge tone="accent">Done</Badge>}
                        {st === 'missed' && <Badge tone="danger">Missed</Badge>}
                      </div>
                    </div>
                  </button>
                  {!moving && !isPast && d.type !== 'rest' && st !== 'done' && (
                    <IconButton icon="swap" label={`Move ${SESSION_INFO[d.type].label}`} size={40} className="mr-3" onClick={() => setMoving(d)} />
                  )}
                </div>
              )
            })}
          </ListGroup>
          {weekIssues.length > 0 && (
            <div className="mt-3 space-y-1">
              {weekIssues.map((i, k) => (
                <p key={k} className={cx('text-[13.5px] flex gap-2', i.severity === 'block' ? 'text-warn' : 'text-muted')}>
                  <Icon name="alert" size={16} className="shrink-0 mt-0.5" /> {formatDay(week[i.day].date, { weekday: 'short' })}: {i.message}
                </p>
              ))}
            </div>
          )}
        </section>

        <section id="levels">
          <SectionHeader title="Exercise levels" />
          <p className="text-[13.5px] text-muted mb-3 px-1">These progress automatically from your logs. Change one if it’s clearly too easy or too hard.</p>
          <ListGroup>
            {Object.values(programme.slots).map((slot) => {
              const ex = getExercise(slot.exerciseId)
              return (
                <ListRow key={slot.slotId} title={ex?.name ?? slot.exerciseId} subtitle={`${TRACKS[slot.trackId].name} · ${slot.sets} × ${slot.target}${slot.metric === 'time' ? 's' : ''}`} onClick={() => setEditSlot(slot)} />
              )
            })}
          </ListGroup>
        </section>

        <section>
          <SectionHeader title="Why your plan looks like this" />
          <Card className="p-4">
            <ul className="space-y-2">
              {programme.rationale.map((r) => (
                <li key={r} className="flex gap-2 text-[14.5px] leading-relaxed">
                  <Icon name="check" size={17} className="text-accent-fg shrink-0 mt-0.5" strokeWidth={2.4} />
                  {r}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="grid gap-2 pb-4">
          <Button size="lg" variant="secondary" block onClick={() => setConfirm('rebuild')}>
            Rebuild schedule from my availability
          </Button>
          <Button size="lg" variant="outline" block onClick={() => setConfirm('restart')}>
            Start a new programme block
          </Button>
          <p className="text-[12.5px] text-faint px-1">Change training days, goals or environment in Profile → Training preferences.</p>
        </section>
      </div>

      <DayPreview plan={preview} onClose={() => setPreview(null)} onMove={(p) => (setPreview(null), setMoving(p))} />

      <Sheet open={!!blocked} onClose={() => setBlocked(null)} title="That creates two hard days in a row">
        {blocked && (
          <div className="space-y-4">
            {blocked.issues.map((i, k) => (
              <p key={k} className="text-[15px]">{i.message}.</p>
            ))}
            <p className="text-[14.5px] text-muted leading-relaxed">Back-to-back hard sessions raise fatigue and make the second one less productive. You can move it and Forge will lighten the second session (fewer sets, easy running).</p>
            <div className="grid gap-2">
              <Button
                size="lg"
                block
                onClick={() => {
                  const r = applyMove(blocked.from, blocked.to, true)
                  if (r.ok) toast('Moved, and the second session was lightened', 'accent')
                  else toast('Still too much load. Try a different day.', 'warn')
                  setBlocked(null)
                  setMoving(null)
                }}
              >
                Move and lighten the second session
              </Button>
              <Button size="lg" variant="ghost" block onClick={() => setBlocked(null)}>
                Pick another day
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <SlotEditor slot={editSlot} onClose={() => setEditSlot(null)} />

      <ConfirmSheet
        open={confirm === 'rebuild'}
        onClose={() => setConfirm(null)}
        title="Rebuild the weekly schedule?"
        body="Your weekly schedule is recreated from your current availability and goals. Exercise levels, running progress and history are kept. Future rearrangements are cleared."
        confirmLabel="Rebuild schedule"
        onConfirm={() => (regenerateProgramme({ keepLevels: true }), toast('Schedule rebuilt', 'accent'))}
      />
      <ConfirmSheet
        open={confirm === 'restart'}
        onClose={() => setConfirm(null)}
        title="Start a new block?"
        body="A fresh programme starts this week, carrying over your current exercise levels and running progress. History is kept."
        confirmLabel="Start new block"
        onConfirm={() => (regenerateProgramme({ keepLevels: true, restart: true }), toast('New block started', 'accent'))}
      />
    </Screen>
  )
}

function SlotEditor({ slot, onClose }: { slot: SlotState | null; onClose: () => void }) {
  const profile = useStore((s) => s.profile)
  const programme = useStore((s) => s.programme)
  const [draft, setDraft] = useState<SlotState | null>(slot)
  useEffect(() => setDraft(slot), [slot])
  if (!slot || !draft || !profile || !programme) return null
  const options = availableTrack(slot.trackId, ctxFromProfile(profile))
  const save = () => {
    saveProgramme({ ...programme, slots: { ...programme.slots, [slot.slotId]: draft } })
    toast('Level updated', 'accent')
    onClose()
  }
  return (
    <Sheet open={!!slot} onClose={onClose} title={TRACKS[slot.trackId].name}>
      <div className="space-y-4">
        <p className="text-[14px] text-muted">{TRACKS[slot.trackId].description}</p>
        <div className="space-y-1.5">
          {options.map((ex, i) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                const range = rangeFor(ex)
                setDraft({ ...draft, exerciseId: ex.id, metric: ex.metric, range, target: ex.id === slot.exerciseId ? slot.target : range[0] })
              }}
              className={cx('press w-full flex items-center gap-3 p-3 rounded-[14px] text-left border', draft.exerciseId === ex.id ? 'bg-accent-soft border-accent-fg' : 'bg-raised border-transparent')}
            >
              <span className="num w-6 text-center text-muted text-[13px]">{i + 1}</span>
              <span className="flex-1 font-medium">{ex.name}</span>
              {ex.id === slot.exerciseId && <Badge>Current</Badge>}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <div className="text-[13px] text-muted font-semibold mb-2 text-center">Sets</div>
            <Stepper value={draft.sets} onChange={(v) => setDraft({ ...draft, sets: v })} min={1} max={5} label="Sets" />
          </div>
          <div>
            <div className="text-[13px] text-muted font-semibold mb-2 text-center">Target {draft.metric === 'time' ? '(s)' : '(reps)'}</div>
            <Stepper value={draft.target} onChange={(v) => setDraft({ ...draft, target: v })} min={draft.range[0]} max={draft.range[1]} step={draft.metric === 'time' ? 5 : 1} label="Target" />
          </div>
        </div>
        <p className="text-[12.5px] text-faint">Target range for this exercise: {draft.range[0]}–{draft.range[1]}{draft.metric === 'time' ? ' s' : ' reps'}.</p>
        <Button size="lg" block onClick={save}>
          Save
        </Button>
      </div>
    </Sheet>
  )
}
