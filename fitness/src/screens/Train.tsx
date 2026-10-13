import { useState } from 'react'
import { DayPreview } from '../components/DayPreview'
import { Icon, type IconName } from '../components/Icon'
import { Screen } from '../components/Layout'
import { SessionIcon, WeekStrip } from '../components/Training'
import { Badge, Card, ListGroup, ListRow, ProgressBar, SectionHeader, TextLink } from '../components/ui'
import { getExercise } from '../engine/library'
import { describeRunWalk } from '../engine/running'
import { dayStatus, SESSION_INFO, weekPlan, type DayPlan } from '../engine/schedule'
import { QUALITY_STAGES } from '../data/running'
import { TRACKS } from '../data/exercises'
import { dayKey, formatDay } from '../lib/date'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import type { TrackId } from '../lib/types'

const SHOWN_TRACKS: TrackId[] = ['push', 'vertical-push', 'squat', 'single-leg', 'hinge', 'upper-back', 'bar-pull', 'plank', 'hollow']

export function Train() {
  const programme = useStore((s) => s.programme)
  const workouts = useStore((s) => s.workouts)
  const runs = useStore((s) => s.runs)
  const [preview, setPreview] = useState<DayPlan | null>(null)
  const today = dayKey()
  if (!programme) return <Screen title="Train"><p className="text-muted">Finish setup to see your programme.</p></Screen>
  const week = weekPlan(programme, today)
  const current = week[0].week
  const rs = programme.run

  const actions: { icon: IconName; title: string; sub: string; to: string; tone: 'accent' | 'run' | 'calm' | 'neutral' }[] = [
    { icon: 'sparkle', title: 'Workout generator', sub: 'Build a session for your time and energy', to: '/generate', tone: 'accent' },
    { icon: 'run', title: 'Free run', sub: 'Track any run with GPS or timer', to: '/run?type=free', tone: 'run' },
    { icon: 'edit', title: 'Log a run', sub: 'From a watch, treadmill or memory', to: '/run/log', tone: 'run' },
    { icon: 'leaf', title: 'Mobility routines', sub: 'Short, goal-specific flows', to: '/library?tab=routines', tone: 'calm' },
  ]

  return (
    <Screen title="Train" eyebrow={current >= 1 && current <= programme.weeks ? `Week ${current} of ${programme.weeks}` : 'Programme'}>
      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">Programme progress</span>
            <span className="text-[13.5px] text-muted num">
              {Math.min(Math.max(current - 1, 0), programme.weeks)}/{programme.weeks} weeks
            </span>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: programme.weeks }, (_, i) => i + 1).map((w) => (
              <div key={w} className={`flex-1 h-2 rounded-full ${w < current ? 'bg-accent' : w === current ? 'bg-accent/50' : programme.deloadWeeks.includes(w) || programme.extraDeloadWeeks.includes(w) ? 'bg-calm-soft' : 'bg-raised'}`} />
            ))}
          </div>
          <div className="flex justify-between text-[12px] text-faint mt-2">
            <span>Started {formatDay(programme.startDate, { day: 'numeric', month: 'short' })}</span>
            <span>Deload: {[...programme.deloadWeeks, ...programme.extraDeloadWeeks].sort((a, b) => a - b).map((w) => `wk ${w}`).join(', ') || 'none'}</span>
          </div>
        </Card>

        <section>
          <SectionHeader title="This week" action={<TextLink onClick={() => navigate('/plan')}>Manage plan</TextLink>} />
          <Card className="p-4 mb-3">
            <WeekStrip onSelect={setPreview} />
          </Card>
          <ListGroup>
            {week.map((d) => {
              const st = dayStatus(d, workouts, runs, today)
              return (
                <button key={d.date} type="button" onClick={() => setPreview(d)} className="press w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-raised">
                  <SessionIcon type={d.type} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15.5px] font-semibold truncate">{SESSION_INFO[d.type].label}</div>
                    <div className="text-[13px] text-muted">{d.date === today ? 'Today' : formatDay(d.date)}</div>
                  </div>
                  {st === 'done' && <Badge tone="accent">Done</Badge>}
                  {st === 'missed' && <Badge tone="danger">Missed</Badge>}
                  {st === 'skipped' && <Badge>Skipped</Badge>}
                  {st === 'today' && <Badge tone="accent">Today</Badge>}
                  {d.lighten && st !== 'done' && <Badge tone="calm">Lighter</Badge>}
                  <Icon name="chevronRight" size={18} className="text-faint" />
                </button>
              )
            })}
          </ListGroup>
        </section>

        <section>
          <SectionHeader title="More training" />
          <div className="grid grid-cols-2 gap-2">
            {actions.map((a) => (
              <Card key={a.title} className="p-4" onClick={() => navigate(a.to)}>
                <span className={`w-9 h-9 rounded-[11px] grid place-items-center ${a.tone === 'accent' ? 'bg-accent-soft text-accent-fg' : a.tone === 'run' ? 'bg-run-soft text-run' : 'bg-calm-soft text-calm'}`}>
                  <Icon name={a.icon} size={19} />
                </span>
                <div className="font-semibold mt-3 leading-tight">{a.title}</div>
                <div className="text-[13px] text-muted mt-0.5 leading-snug">{a.sub}</div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Current levels" action={<TextLink onClick={() => navigate('/plan?section=levels')}>Adjust</TextLink>} />
          <ListGroup>
            {SHOWN_TRACKS.filter((t) => programme.slots[t]).map((t) => {
              const slot = programme.slots[t]
              const ex = getExercise(slot.exerciseId)
              const ids = TRACKS[t].exerciseIds
              const level = ids.indexOf(slot.exerciseId)
              return (
                <ListRow
                  key={t}
                  title={ex?.name ?? slot.exerciseId}
                  subtitle={`${TRACKS[t].name} · ${slot.sets} × ${slot.target}${slot.metric === 'time' ? 's' : ''}`}
                  right={
                    <div className="w-14">
                      <ProgressBar value={(level + 1) / ids.length} label={`Level ${level + 1} of ${ids.length}`} />
                    </div>
                  }
                  onClick={() => navigate(`/library/${slot.exerciseId}`)}
                />
              )
            })}
          </ListGroup>
        </section>

        <section>
          <SectionHeader title="Running" />
          <Card className="p-4 space-y-2">
            {rs.runWalkStage >= 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Run/walk stage {rs.runWalkStage + 1}</span>
                  <Badge tone="run">{describeRunWalk(rs.runWalkStage)}</Badge>
                </div>
                <p className="text-[14px] text-muted">Complete a stage twice without it feeling hard to move on. {rs.stageSuccesses ? `${rs.stageSuccesses} of 2 done at this stage.` : ''}</p>
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="num text-[22px] font-bold">{rs.easyMinutes}</div>
                    <div className="text-[12px] text-muted">min easy</div>
                  </div>
                  <div>
                    <div className="num text-[22px] font-bold">{rs.longMinutes}</div>
                    <div className="text-[12px] text-muted">min long</div>
                  </div>
                  <div>
                    <div className="num text-[22px] font-bold">{rs.qualityStage + 1}</div>
                    <div className="text-[12px] text-muted">quality stage</div>
                  </div>
                </div>
                <p className="text-[13.5px] text-muted">Next quality session: {QUALITY_STAGES[Math.min(rs.qualityStage, QUALITY_STAGES.length - 1)].name}. Volume and intensity never increase in the same week.</p>
              </>
            )}
          </Card>
        </section>

        <ListGroup>
          <ListRow icon="calendar" title="Training calendar" subtitle="Scheduled, completed and missed sessions" onClick={() => navigate('/calendar')} />
          <ListRow icon="clock" title="Workout history" subtitle="Browse, filter and repeat past sessions" onClick={() => navigate('/history')} />
        </ListGroup>
      </div>
      <DayPreview plan={preview} onClose={() => setPreview(null)} onMove={() => (setPreview(null), navigate('/plan'))} />
    </Screen>
  )
}
