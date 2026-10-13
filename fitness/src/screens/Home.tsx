import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Layout'
import { CheckInCard, IntensityBadge, KIND_META, RecommendationCard, SessionIcon, sessionIntensity, WeekStrip } from '../components/Training'
import { Badge, Button, Card, cx, IconButton, Notice, ProgressBar, ProgressRing, SectionHeader, Sheet, Stat, TextLink, toast } from '../components/ui'
import { milestones, nextMilestone } from '../engine/milestones'
import { shouldSuggestDeload } from '../engine/readiness'
import { buildRunPlan } from '../engine/running'
import { dayStatus, isPlanDone, isRunSession, missedThisWeek, planFor, SESSION_INFO, weekPlan, type DayPlan } from '../engine/schedule'
import { weeklyStats } from '../engine/stats'
import { SESSION_PURPOSE } from '../engine/programme'
import { catchUpMissed, setOverride, takeDeloadThisWeek } from '../lib/actions'
import { addDays, dayKey, greeting, parseDay, WEEKDAY_LONG, weekdayOf } from '../lib/date'
import { formatMinutes } from '../lib/format'
import { navigate } from '../lib/router'
import { previewWorkout, startPlanned } from '../lib/session'
import { useStore } from '../lib/store'
import type { SessionType } from '../lib/types'
import { distanceValue } from '../lib/units'

export function Home() {
  const profile = useStore((s) => s.profile)!
  const programme = useStore((s) => s.programme)
  const workouts = useStore((s) => s.workouts)
  const runs = useStore((s) => s.runs)
  const checkIns = useStore((s) => s.checkIns)
  const recs = useStore((s) => s.recommendations.filter((r) => r.status === 'pending'))
  const today = dayKey()
  const [adjustOpen, setAdjustOpen] = useState(false)

  const plan = programme ? planFor(programme, today) : null
  const week = programme ? weekPlan(programme, today) : []
  const doneToday = plan ? isPlanDone(plan, workouts, runs) : false
  const missed = programme ? missedThisWeek(programme, workouts, runs, today) : []
  const plannedCount = week.filter((d) => d.type !== 'rest' && !d.skipped).length
  const doneCount = week.filter((d) => dayStatus(d, workouts, runs, today) === 'done').length
  const stats = useMemo(() => weeklyStats(workouts, runs, 2, today), [workouts, runs, today])
  const ms = useMemo(() => nextMilestone(milestones({ workouts, runs, programme, today })), [workouts, runs, programme, today])
  const deloadSuggested = plan && !plan.isDeload && shouldSuggestDeload(checkIns)

  const est = useMemo(() => {
    if (!plan || plan.type === 'rest' || !programme) return null
    if (isRunSession(plan.type)) return Math.round(buildRunPlan(plan.type, profile, programme, { deload: plan.isDeload, lighten: plan.lighten, week: plan.week }).totalSec / 60)
    return previewWorkout(plan)?.estimatedMinutes ?? null
  }, [plan, programme, profile])

  const runDetail = plan && programme && isRunSession(plan.type) ? buildRunPlan(plan.type, profile, programme, { deload: plan.isDeload, lighten: plan.lighten, week: plan.week }) : null

  if (!programme || !plan) {
    return (
      <Screen title="Welcome">
        <Notice title="No programme yet" action={<Button onClick={() => navigate('/onboarding')}>Set up programme</Button>}>
          Complete setup to get your training plan.
        </Notice>
      </Screen>
    )
  }

  const afterProgramme = plan.week > programme.weeks
  const title = plan.type === 'rest' ? 'Rest day' : runDetail ? runDetail.title : SESSION_INFO[plan.type].label
  const kind = SESSION_INFO[plan.type].kind

  return (
    <Screen
      eyebrow={`${greeting()}${profile.name ? `, ${profile.name}` : ''}`}
      title={parseDay(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      actions={<IconButton icon="calendar" label="Calendar" variant="ghost" onClick={() => navigate('/calendar')} />}
    >
      <div className="space-y-6">
        {afterProgramme && (
          <Notice tone="accent" icon="trophy" title="Programme complete" action={<Button onClick={() => navigate('/plan')}>Start the next block</Button>}>
            You’ve reached the end of your {programme.weeks}-week programme. Start a new block that keeps your current exercise levels.
          </Notice>
        )}

        {/* ── Today ── */}
        <section aria-labelledby="today-h" className="animate-rise">
          <Card className={cx('p-5 overflow-hidden relative', kind === 'strength' && !doneToday && 'border-accent-fg/30')}>
            <div className="flex items-start gap-3">
              <SessionIcon type={plan.type} size={44} />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted">Today · {plan.inProgramme ? `Week ${plan.week} of ${programme.weeks}` : 'Off programme'}</div>
                <h2 id="today-h" className="text-[24px] font-bold tracking-[-0.02em] leading-tight mt-0.5">
                  {title}
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {plan.type !== 'rest' && <IntensityBadge intensity={sessionIntensity(plan.type, plan.lighten, plan.isDeload)} />}
              {est !== null && (
                <Badge>
                  <Icon name="clock" size={13} /> ~{formatMinutes(est)}
                </Badge>
              )}
              {plan.isDeload && <Badge tone="calm">Deload week</Badge>}
              {plan.lighten && <Badge tone="calm">Lighter</Badge>}
              {plan.moved && <Badge>Rearranged</Badge>}
            </div>
            <p className="text-[15px] text-muted mt-3 leading-relaxed">
              {plan.type === 'rest'
                ? 'Recovery is where the adaptation happens. If you feel like moving, a gentle mobility flow is optional, not required.'
                : runDetail
                  ? runDetail.purpose
                  : SESSION_PURPOSE[plan.type]}
            </p>
            {doneToday ? (
              <div className="mt-5 flex items-center gap-3 p-3 rounded-[16px] bg-accent-soft">
                <Icon name="check" size={22} className="text-accent-fg" strokeWidth={2.6} />
                <span className="flex-1 font-semibold">Done for today. Nice work.</span>
                <TextLink onClick={() => navigate('/history')}>View</TextLink>
              </div>
            ) : plan.type === 'rest' ? (
              <div className="grid grid-cols-2 gap-2 mt-5">
                <Button variant="secondary" size="lg" icon="leaf" onClick={() => navigate('/library/routine/rest-day-flow')}>
                  Mobility
                </Button>
                <Button variant="ghost" size="lg" onClick={() => setAdjustOpen(true)}>
                  Train anyway
                </Button>
              </div>
            ) : plan.skipped ? (
              <div className="mt-5 flex items-center gap-3">
                <span className="flex-1 text-[14.5px] text-muted">Skipped for today.</span>
                <Button variant="secondary" size="sm" onClick={() => setOverride(today, { skipped: false })}>
                  Undo
                </Button>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                <Button size="xl" icon="play" onClick={() => startPlanned(today)}>
                  {isRunSession(plan.type) ? 'Start run' : 'Start workout'}
                </Button>
                <Button size="xl" variant="secondary" aria-label="Adjust today’s session" onClick={() => setAdjustOpen(true)}>
                  <Icon name="swap" size={22} />
                </Button>
              </div>
            )}
          </Card>
        </section>

        {missed.length > 0 && !doneToday && (
          <section className="space-y-2">
            {missed.slice(-1).map((m) => (
              <Notice
                key={m.date}
                tone="neutral"
                icon="calendar"
                title={`Missed ${WEEKDAY_LONG[weekdayOf(m.date)]}’s ${SESSION_INFO[m.type].short}`}
                action={
                  <div className="flex gap-2">
                    {plan.type !== 'rest' && SESSION_INFO[plan.type].hard && SESSION_INFO[m.type].hard ? null : (
                      <Button size="sm" onClick={() => (catchUpMissed(m.date), toast('Moved to today', 'accent'))}>
                        Do it today
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setOverride(m.date, { skipped: true })}>
                      Let it go
                    </Button>
                  </div>
                }
              >
                Life happens.{' '}
                {plan.type !== 'rest' && SESSION_INFO[plan.type].hard && SESSION_INFO[m.type].hard
                  ? 'Today already has a hard session, so let it go rather than doubling up.'
                  : 'You can do it today, or skip it and carry on. Don’t try to cram everything in.'}
              </Notice>
            ))}
          </section>
        )}

        {deloadSuggested && (
          <Notice
            tone="calm"
            icon="moon"
            title="Fatigue has been building"
            action={
              <Button size="sm" variant="secondary" onClick={() => (takeDeloadThisWeek(), toast('This week is now a deload week', 'calm'))}>
                Make this a deload week
              </Button>
            }
          >
            Three of your recent check-ins were low. A reduced-volume week now often leads to better training next week.
          </Notice>
        )}

        <CheckInCard />

        {recs.length > 0 && (
          <section>
            <SectionHeader title="Progression" />
            <div className="space-y-3">
              {recs.slice(0, 2).map((r) => (
                <RecommendationCard key={r.id} rec={r} />
              ))}
            </div>
          </section>
        )}

        {/* ── This week ── */}
        <section>
          <SectionHeader title="This week" action={<TextLink onClick={() => navigate('/plan')}>Rearrange</TextLink>} />
          <Card className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <ProgressRing value={plannedCount ? doneCount / plannedCount : 0} size={56} stroke={6} label={`${doneCount} of ${plannedCount} sessions`}>
                <span className="num text-[14px] font-bold">
                  {doneCount}/{plannedCount}
                </span>
              </ProgressRing>
              <div className="flex-1">
                <div className="font-semibold text-[16px]">
                  {doneCount === plannedCount && plannedCount > 0 ? 'Week complete' : `${plannedCount - doneCount} session${plannedCount - doneCount === 1 ? '' : 's'} to go`}
                </div>
                <div className="text-[13.5px] text-muted">{plan.isDeload ? 'Deload week: lighter by design.' : 'Consistency beats intensity.'}</div>
              </div>
            </div>
            <WeekStrip />
          </Card>
        </section>

        {/* ── Quick options ── */}
        <section>
          <SectionHeader title="Short on time?" />
          <div className="grid grid-cols-3 gap-2">
            {[10, 20, 30].map((m) => (
              <Card key={m} className="p-3.5 text-center" onClick={() => quickStart(m, plan)} aria-label={`Start a ${m}-minute workout`}>
                <div className="num text-[24px] font-bold leading-none">{m}</div>
                <div className="text-[12.5px] text-muted mt-1">min {plan.type !== 'rest' && !doneToday ? 'version' : 'workout'}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Trends ── */}
        <section>
          <SectionHeader title="Trends" action={<TextLink onClick={() => navigate('/progress')}>All progress</TextLink>} />
          <Card className="p-4 grid grid-cols-3 gap-3">
            <Stat label="Sessions" value={stats[1].sessions} sub={<Delta now={stats[1].sessions} prev={stats[0].sessions} />} />
            <Stat label="Sets" value={stats[1].workingSets} sub={<Delta now={stats[1].workingSets} prev={stats[0].workingSets} />} />
            <Stat
              label={profile.units.distance === 'km' ? 'Km run' : 'Miles'}
              value={distanceValue(stats[1].runDistanceM, profile.units).toFixed(1)}
              sub={<Delta now={stats[1].runDistanceM} prev={stats[0].runDistanceM} />}
            />
          </Card>
          <p className="text-[12.5px] text-faint mt-2 px-1">This week vs last week, from your logged training.</p>
        </section>

        {ms && (
          <section>
            <SectionHeader title="Next milestone" />
            <Card className="p-4" onClick={() => navigate('/progress')}>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-[12px] bg-raised grid place-items-center">
                  <Icon name="trophy" size={20} />
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{ms.title}</div>
                  <div className="text-[13.5px] text-muted">{ms.detail}</div>
                </div>
              </div>
              <ProgressBar value={ms.progress ?? 0} className="mt-3" label={`${ms.title} progress`} />
            </Card>
          </section>
        )}
      </div>

      <AdjustSheet open={adjustOpen} onClose={() => setAdjustOpen(false)} plan={plan} />
    </Screen>
  )
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!now && !prev) return <span className="text-faint">—</span>
  if (prev === 0) return <span className="text-accent-fg">New</span>
  const d = Math.round(((now - prev) / prev) * 100)
  return <span className={d >= 0 ? 'text-accent-fg' : 'text-muted'}>{d >= 0 ? `+${d}%` : `${d}%`}</span>
}

function quickStart(minutes: number, plan: DayPlan) {
  if (plan.type !== 'rest' && !plan.skipped) startPlanned(plan.date, { minutes })
  else navigate(`/generate?minutes=${minutes}`)
}

function AdjustSheet({ open, onClose, plan }: { open: boolean; onClose: () => void; plan: DayPlan }) {
  const outdoor = useStore((s) => s.settings.outdoorMode)
  const programme = useStore((s) => s.programme)
  // A hard session swapped in next to another hard day is automatically made lighter.
  const hardNeighbour = (type: SessionType) => {
    if (!programme || !SESSION_INFO[type].hard) return null
    for (const d of [addDays(plan.date, -1), addDays(plan.date, 1)]) {
      const n = planFor(programme, d)
      if (!n.skipped && SESSION_INFO[n.type].hard) return `${WEEKDAY_LONG[weekdayOf(d)]}’s ${SESSION_INFO[n.type].label}`
    }
    return null
  }
  const swaps: { type: SessionType; why: string }[] = [
    { type: 'mobility', why: 'Low energy, sore, or short on time' },
    { type: 'run-easy', why: 'Want to get outside and move easily' },
    { type: 'conditioning', why: 'A quick circuit instead' },
    { type: 'strength-a', why: 'Full-body strength' },
  ].filter((s) => s.type !== plan.type) as { type: SessionType; why: string }[]
  const today = plan.date
  return (
    <Sheet open={open} onClose={onClose} title="Adjust today">
      <div className="space-y-5">
        {plan.type !== 'rest' && (
          <div>
            <SectionHeader title="Same session, less time" />
            <div className="grid grid-cols-3 gap-2">
              {[10, 20, 30].map((m) => (
                <Button key={m} variant="secondary" size="lg" onClick={() => (onClose(), startPlanned(today, { minutes: m }))}>
                  {m} min
                </Button>
              ))}
            </div>
          </div>
        )}
        {plan.type !== 'rest' && (
          <div className="grid gap-2">
            <Button variant="secondary" size="lg" block icon="leaf" onClick={() => (onClose(), startPlanned(today, { lighten: true }))}>
              Start a lighter version
            </Button>
            <Button variant="secondary" size="lg" block icon="pin" onClick={() => (onClose(), startPlanned(today, { strictNoEquipment: true }))}>
              No-equipment version{outdoor ? ' (outdoor mode is on)' : ''}
            </Button>
          </div>
        )}
        <div>
          <SectionHeader title="Swap the session" />
          <div className="space-y-2">
            {swaps.map((s) => {
              const clash = hardNeighbour(s.type)
              return (
                <button
                  key={s.type}
                  type="button"
                  className="press w-full flex items-center gap-3 p-3 rounded-[16px] bg-raised text-left"
                  onClick={() => {
                    setOverride(today, { type: s.type, lighten: !!clash })
                    toast(`Today is now: ${SESSION_INFO[s.type].label}${clash ? ' (lighter)' : ''}`, 'accent')
                    onClose()
                  }}
                >
                  <SessionIcon type={s.type} size={36} />
                  <span className="flex-1">
                    <span className="block font-semibold text-[15px]">{SESSION_INFO[s.type].label}</span>
                    <span className="block text-[13px] text-muted">{s.why}</span>
                    {clash && <span className="block text-[12.5px] text-warn mt-0.5">Lighter version, since {clash} is next to it</span>}
                  </span>
                  <span className="text-[12px] text-faint">{KIND_META[SESSION_INFO[s.type].kind].label}</span>
                </button>
              )
            })}
          </div>
          <p className="text-[12.5px] text-faint mt-2 px-1">Swapping only changes today. Your weekly plan keeps its balance.</p>
        </div>
        <div className={cx('grid gap-2', plan.type !== 'rest' && 'grid-cols-2')}>
          {plan.type !== 'rest' && (
            <Button variant="outline" onClick={() => (onClose(), navigate('/plan'))}>
              Move to another day
            </Button>
          )}
          <Button variant="outline" onClick={() => (onClose(), navigate('/generate'))}>
            Build a custom workout
          </Button>
        </div>
        {plan.type !== 'rest' && (
          <Button variant="ghost" block onClick={() => (setOverride(today, { skipped: true }), onClose())}>
            Skip today (rest instead)
          </Button>
        )}
      </div>
    </Sheet>
  )
}
