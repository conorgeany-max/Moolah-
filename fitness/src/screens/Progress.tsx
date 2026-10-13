import { useMemo, useState } from 'react'
import { BarChart, LineChart, type Point } from '../components/Charts'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Layout'
import { Badge, Button, Card, EmptyState, ListGroup, ListRow, ProgressBar, ProgressRing, SectionHeader, Segmented, Stat } from '../components/ui'
import { TRACKS } from '../data/exercises'
import { getExercise } from '../engine/library'
import { milestones } from '../engine/milestones'
import { exerciseBests, runPace, runRecords } from '../engine/records'
import { consistency, paceTrend, trackTrend, weeklyStats } from '../engine/stats'
import { formatDay, parseDay } from '../lib/date'
import { formatDuration } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import type { TrackId } from '../lib/types'
import { distanceValue, formatPace, paceValue } from '../lib/units'

type Tab = 'overview' | 'strength' | 'running'

const shortDate = (d: string) => parseDay(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export function Progress() {
  const [tab, setTab] = useState<Tab>('overview')
  return (
    <Screen title="Progress">
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'strength', label: 'Strength' },
          { value: 'running', label: 'Running' },
        ]}
      />
      {tab === 'overview' && <Overview />}
      {tab === 'strength' && <Strength />}
      {tab === 'running' && <Running />}
    </Screen>
  )
}

function Overview() {
  const workouts = useStore((s) => s.workouts)
  const runs = useStore((s) => s.runs)
  const programme = useStore((s) => s.programme)
  const weeks = useMemo(() => weeklyStats(workouts, runs, 10), [workouts, runs])
  const cons = useMemo(() => (programme ? consistency(programme, workouts, runs) : null), [programme, workouts, runs])
  const ms = useMemo(() => milestones({ workouts, runs, programme, today: new Date().toISOString().slice(0, 10) }), [workouts, runs, programme])
  const achieved = ms.filter((m) => m.achievedOn).sort((a, b) => b.achievedOn!.localeCompare(a.achievedOn!))
  const upcoming = ms.filter((m) => !m.achievedOn).sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0)).slice(0, 4)
  const total = workouts.filter((w) => w.status !== 'active').length + runs.filter((r) => r.status === 'completed').length

  if (total === 0)
    return (
      <EmptyState
        icon="chart"
        title="Your progress starts with one session"
        body="Charts here are built only from what you log: sets, holds, runs and check-ins. Nothing is estimated or filled in."
        action={<Button onClick={() => navigate('/')}>Go to today’s session</Button>}
      />
    )

  return (
    <div className="space-y-6">
      {cons && (
        <Card className="p-5 flex items-center gap-4">
          <ProgressRing value={cons.rate} size={76} stroke={8} label={`${Math.round(cons.rate * 100)}% of planned sessions completed`}>
            <span className="num text-[18px] font-bold">{Math.round(cons.rate * 100)}%</span>
          </ProgressRing>
          <div className="flex-1">
            <div className="font-semibold text-[17px]">Consistency</div>
            <p className="text-[14px] text-muted leading-snug mt-0.5">
              {cons.done} of {cons.planned} planned sessions completed this programme. Skipped days you chose to rest don’t count against you.
            </p>
          </div>
        </Card>
      )}
      <section>
        <SectionHeader title="Training frequency" />
        <Card className="p-4">
          <BarChart ariaLabel="Sessions per week" bars={weeks.map((w) => ({ label: shortDate(w.monday).split(' ')[0], value: w.sessions, note: `Week of ${shortDate(w.monday)}` }))} format={(v) => `${v} session${v === 1 ? '' : 's'}`} />
        </Card>
      </section>
      <section>
        <SectionHeader title="Working sets per week" />
        <Card className="p-4">
          <BarChart ariaLabel="Working sets per week" bars={weeks.map((w) => ({ label: shortDate(w.monday).split(' ')[0], value: w.workingSets, note: `Week of ${shortDate(w.monday)}` }))} format={(v) => `${v} sets`} />
          <p className="text-[12.5px] text-faint mt-2">Volume, not strength. Strength progress is in the Strength tab.</p>
        </Card>
      </section>
      <section>
        <SectionHeader title="Milestones" />
        <ListGroup>
          {achieved.map((m) => (
            <ListRow key={m.id} icon="trophy" iconTone="accent" title={m.title} subtitle={`Achieved ${formatDay(m.achievedOn!)}`} />
          ))}
          {upcoming.map((m) => (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-[11px] bg-raised grid place-items-center text-muted">
                  <Icon name="target" size={18} />
                </span>
                <div className="flex-1">
                  <div className="font-medium">{m.title}</div>
                  <div className="text-[13px] text-muted">{m.detail}</div>
                </div>
              </div>
              <ProgressBar value={m.progress ?? 0} className="mt-2 ml-12" label={`${m.title} progress`} />
            </div>
          ))}
        </ListGroup>
      </section>
    </div>
  )
}

const STRENGTH_CHARTS: { track: TrackId; title: string; unit: string }[] = [
  { track: 'push', title: 'Push-up pathway', unit: 'reps' },
  { track: 'squat', title: 'Squat pathway', unit: 'reps' },
  { track: 'single-leg', title: 'Single-leg strength', unit: 'reps' },
  { track: 'plank', title: 'Core holds (plank pathway)', unit: 's' },
  { track: 'hollow', title: 'Hollow body', unit: '' },
  { track: 'upper-back', title: 'Upper back', unit: 'reps' },
]

function Strength() {
  const workouts = useStore((s) => s.workouts)
  const bests = useMemo(() => [...exerciseBests(workouts).values()].filter((b) => {
    const c = getExercise(b.exerciseId)?.category
    return c && c !== 'mobility' && c !== 'stretch'
  }), [workouts])
  const charts = STRENGTH_CHARTS.map((c) => ({ ...c, pts: trackTrend(workouts, c.track) })).filter((c) => c.pts.length)
  if (!charts.length && !bests.length) return <EmptyState icon="bolt" title="No strength sessions yet" body="Log a strength workout to see your best sets and variations here." />
  return (
    <div className="space-y-6">
      <p className="text-[13.5px] text-muted px-1 leading-relaxed">Each point is your best single set that session. A filled dot marks a move to a new variation, which often means fewer reps of a harder exercise: that’s progress too.</p>
      {charts.map((c) => {
        const points: Point[] = c.pts.map((p, i) => ({ x: shortDate(p.date), y: p.value, marker: i > 0 && p.level !== c.pts[i - 1].level, note: `${p.label} · ${shortDate(p.date)}` }))
        const current = c.pts.at(-1)!
        return (
          <section key={c.track}>
            <SectionHeader title={c.title} action={<Badge tone="accent">{current.label}</Badge>} />
            <Card className="p-4">
              <LineChart ariaLabel={`${c.title} best set per session`} points={points} format={(v) => `${v}${c.track === 'plank' || getExercise(current.exerciseId)?.metric === 'time' ? ' s' : ' reps'}`} />
            </Card>
          </section>
        )
      })}
      <section>
        <SectionHeader title="Personal records" />
        <ListGroup>
          {bests
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((b) => {
              const ex = getExercise(b.exerciseId)!
              return (
                <ListRow
                  key={b.exerciseId}
                  title={ex.name}
                  subtitle={`${b.metric === 'time' ? 'Longest hold' : 'Best set'} · ${formatDay(b.date)}`}
                  right={
                    <span className="num font-bold text-[17px]">
                      {b.best}
                      <span className="text-[13px] text-muted font-medium">{b.metric === 'time' ? 's' : b.metric === 'distance' ? 'm' : ''}</span>
                    </span>
                  }
                  onClick={() => navigate(`/library/${b.exerciseId}`)}
                  chevron={false}
                />
              )
            })}
        </ListGroup>
        <p className="text-[12.5px] text-faint mt-2 px-1">Records compare the same variation only. {Object.keys(TRACKS).length} progression pathways are tracked.</p>
      </section>
    </div>
  )
}

function Running() {
  const runs = useStore((s) => s.runs)
  const units = useStore((s) => s.profile!.units)
  const weeks = useMemo(() => weeklyStats([], runs, 10), [runs])
  const pace = useMemo(() => paceTrend(runs), [runs])
  const rec = useMemo(() => runRecords(runs), [runs])
  const done = runs.filter((r) => r.status === 'completed')
  if (!done.length)
    return <EmptyState icon="run" title="No runs yet" body="Track a run with GPS or the timer, or log one manually, to see distance, pace and consistency here." action={<Button onClick={() => navigate('/run?type=free')}>Start a run</Button>} />
  const totalDist = done.reduce((a, r) => a + r.distanceM, 0)
  const totalTime = done.reduce((a, r) => a + r.activeMs, 0)
  return (
    <div className="space-y-6">
      <Card className="p-4 grid grid-cols-3 gap-3">
        <Stat label="Runs" value={done.length} />
        <Stat label="Distance" value={distanceValue(totalDist, units).toFixed(1)} unit={units.distance} />
        <Stat label="Time" value={formatDuration(totalTime, true).replace(/:\d\d$/, '')} unit="h" />
      </Card>
      <section>
        <SectionHeader title="Weekly distance" />
        <Card className="p-4">
          <BarChart ariaLabel="Running distance per week" color="var(--run)" bars={weeks.map((w) => ({ label: shortDate(w.monday).split(' ')[0], value: distanceValue(w.runDistanceM, units), note: `Week of ${shortDate(w.monday)}` }))} format={(v) => `${v.toFixed(1)} ${units.distance}`} />
        </Card>
      </section>
      <section>
        <SectionHeader title="Weekly running time" />
        <Card className="p-4">
          <BarChart ariaLabel="Running minutes per week" color="var(--run)" bars={weeks.map((w) => ({ label: shortDate(w.monday).split(' ')[0], value: Math.round(w.runMinutes), note: `Week of ${shortDate(w.monday)}` }))} format={(v) => `${v} min`} />
        </Card>
      </section>
      <section>
        <SectionHeader title="Average pace" />
        <Card className="p-4">
          <LineChart
            ariaLabel="Average pace per run"
            color="var(--run)"
            invert
            points={pace.map((p) => ({ x: shortDate(p.date), y: paceValue(p.secPerKm, units), note: `${p.run.title} · ${distanceValue(p.distanceM, units).toFixed(1)} ${units.distance}` }))}
            format={(v) => formatPace(units.distance === 'km' ? v : v / 1.609344, units)}
            empty="Runs need a distance to show pace."
          />
          <p className="text-[12.5px] text-faint mt-2">Higher on the chart is faster. Easy runs should stay easy, so pace naturally varies with the session type, terrain and weather.</p>
        </Card>
      </section>
      <section>
        <SectionHeader title="Running records" />
        <ListGroup>
          {rec.longestDistance && <ListRow title="Longest run" subtitle={formatDay(rec.longestDistance.date)} right={<span className="num font-bold">{distanceValue(rec.longestDistance.distanceM, units).toFixed(2)} {units.distance}</span>} onClick={() => navigate(`/run/${rec.longestDistance!.id}`)} chevron={false} />}
          {rec.longestDuration && <ListRow title="Longest time" subtitle={formatDay(rec.longestDuration.date)} right={<span className="num font-bold">{formatDuration(rec.longestDuration.activeMs)}</span>} onClick={() => navigate(`/run/${rec.longestDuration!.id}`)} chevron={false} />}
          {rec.fastestPace && <ListRow title="Fastest average pace (3 km+)" subtitle={formatDay(rec.fastestPace.run.date)} right={<span className="num font-bold">{formatPace(rec.fastestPace.secPerKm, units)}</span>} onClick={() => navigate(`/run/${rec.fastestPace!.run.id}`)} chevron={false} />}
          {rec.fastestKm && <ListRow title="Fastest kilometre (GPS)" subtitle={formatDay(rec.fastestKm.run.date)} right={<span className="num font-bold">{formatDuration(rec.fastestKm.sec * 1000)}</span>} onClick={() => navigate(`/run/${rec.fastestKm!.run.id}`)} chevron={false} />}
        </ListGroup>
      </section>
      <section>
        <SectionHeader title="Recent runs" action={<Button size="sm" variant="ghost" onClick={() => navigate('/history')}>All</Button>} />
        <ListGroup>
          {done.slice(0, 5).map((r) => (
            <ListRow key={r.id} icon="run" iconTone="run" title={r.title} subtitle={`${formatDay(r.date)} · ${formatDuration(r.activeMs)}${r.distanceM ? ` · ${distanceValue(r.distanceM, units).toFixed(2)} ${units.distance} · ${formatPace(runPace(r), units)}` : ''}`} onClick={() => navigate(`/run/${r.id}`)} />
          ))}
        </ListGroup>
      </section>
    </div>
  )
}
