import { useMemo } from 'react'
import { getExercise } from '../engine/library'
import { buildRunPlan } from '../engine/running'
import { dayStatus, isRunSession, SESSION_INFO, type DayPlan } from '../engine/schedule'
import { setOverride } from '../lib/actions'
import { dayKey, diffDays, formatDay } from '../lib/date'
import { formatSeconds } from '../lib/format'
import { navigate } from '../lib/router'
import { previewWorkout, startPlanned } from '../lib/session'
import { useStore } from '../lib/store'
import { IntensityBadge, sessionIntensity, SessionIcon } from './Training'
import { Badge, Button, Sheet } from './ui'

/** Bottom sheet showing what a planned day contains, with the relevant actions. */
export function DayPreview({ plan, onClose, onMove }: { plan: DayPlan | null; onClose: () => void; onMove?: (p: DayPlan) => void }) {
  const profile = useStore((s) => s.profile)
  const programme = useStore((s) => s.programme)
  const workouts = useStore((s) => s.workouts)
  const runs = useStore((s) => s.runs)
  const content = useMemo(() => {
    if (!plan || !profile || !programme || plan.type === 'rest') return null
    if (isRunSession(plan.type)) return { run: buildRunPlan(plan.type, profile, programme, { deload: plan.isDeload, lighten: plan.lighten, week: plan.week }) }
    return { workout: previewWorkout(plan) }
  }, [plan, profile, programme])
  if (!plan) return null
  const today = dayKey()
  const st = dayStatus(plan, workouts, runs, today)
  const future = diffDays(plan.date, today) >= 0
  const done = [...workouts.filter((w) => w.date === plan.date && w.status !== 'active'), ...runs.filter((r) => r.date === plan.date && r.status === 'completed')]
  return (
    <Sheet open={!!plan} onClose={onClose} title={formatDay(plan.date, { weekday: 'long', day: 'numeric', month: 'short' })}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <SessionIcon type={plan.type} size={44} />
          <div className="flex-1">
            <div className="text-[18px] font-bold">{content?.run?.title ?? SESSION_INFO[plan.type].label}</div>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {plan.type !== 'rest' && <IntensityBadge intensity={sessionIntensity(plan.type, plan.lighten, plan.isDeload)} />}
              {plan.isDeload && <Badge tone="calm">Deload</Badge>}
              {plan.lighten && <Badge tone="calm">Lighter</Badge>}
              {st === 'done' && <Badge tone="accent">Done</Badge>}
              {st === 'missed' && <Badge tone="danger">Missed</Badge>}
              {st === 'skipped' && <Badge>Skipped</Badge>}
            </div>
          </div>
        </div>
        {plan.type === 'rest' && <p className="text-muted text-[15px]">Rest day. Optional gentle mobility only.</p>}
        {content?.workout && (
          <ul className="rounded-[16px] bg-raised divide-y divide-line">
            {content.workout.blocks
              .filter((b) => b.kind === 'main' || b.kind === 'finisher')
              .flatMap((b) => b.exercises.map((x) => ({ x, circuit: (b.rounds ?? 0) > 1 })))
              .map(({ x, circuit }) => {
                const ex = getExercise(x.exerciseId)
                const t = x.targetReps ?? x.targetSeconds
                return (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 text-[15px]">{ex?.name}</span>
                    <span className="num text-[14px] text-muted">
                      {circuit ? `${x.targetSets} rds` : `${x.targetSets} ×`} {t}
                      {x.targetSeconds ? 's' : ''}
                    </span>
                  </li>
                )
              })}
          </ul>
        )}
        {content?.workout && <p className="text-[13px] text-muted">About {content.workout.estimatedMinutes} min including warm-up and cool-down.</p>}
        {content?.run && (
          <div className="rounded-[16px] bg-raised p-4">
            <p className="text-[14.5px] text-muted leading-relaxed">{content.run.purpose}</p>
            <p className="text-[14px] mt-2">
              <strong>{formatSeconds(content.run.totalSec)}</strong> · {content.run.segments.length} segment{content.run.segments.length === 1 ? '' : 's'}
            </p>
          </div>
        )}
        {done.length > 0 && <p className="text-[14px] text-accent-fg font-medium">Logged: {done.map((d) => d.title).join(', ')}</p>}
        <div className="grid gap-2">
          {plan.date === today && plan.type !== 'rest' && st !== 'done' && !plan.skipped && (
            <Button size="lg" block icon="play" onClick={() => (onClose(), startPlanned(plan.date))}>
              Start now
            </Button>
          )}
          {plan.date !== today && st === 'missed' && isRunSession(plan.type) && (
            <Button size="lg" variant="secondary" block onClick={() => (onClose(), navigate(`/run/log?date=${plan.date}&type=${plan.type}`))}>
              Log this run after the fact
            </Button>
          )}
          {future && onMove && plan.type !== 'rest' && st !== 'done' && (
            <Button size="lg" variant="secondary" block icon="swap" onClick={() => onMove(plan)}>
              Move to another day
            </Button>
          )}
          {future && plan.type !== 'rest' && st !== 'done' && (
            <Button size="lg" variant="ghost" block onClick={() => (setOverride(plan.date, { skipped: !plan.skipped }), onClose())}>
              {plan.skipped ? 'Restore this session' : 'Skip this session'}
            </Button>
          )}
          {future && plan.type !== 'rest' && st !== 'done' && !plan.lighten && (
            <Button size="lg" variant="ghost" block onClick={() => (setOverride(plan.date, { lighten: true }), onClose())}>
              Make it lighter
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
