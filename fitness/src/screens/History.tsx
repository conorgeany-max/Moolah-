import { useMemo, useState } from 'react'
import { Screen } from '../components/Layout'
import { KIND_META, kindOf } from '../components/Training'
import { Badge, Button, Card, ConfirmSheet, EmptyState, IconButton, ListGroup, ListRow, Segmented, SectionHeader, Stat } from '../components/ui'
import { getExercise } from '../engine/library'
import { newWorkout } from '../engine/programme'
import { valueOf } from '../engine/progression'
import { runPace, runRecordHits } from '../engine/records'
import { gpsIncrement, MAX_ACCURACY_M } from '../engine/running'
import { workingSets } from '../engine/steps'
import { deleteRun, deleteWorkout } from '../lib/actions'
import { dayKey, formatDay, parseDay } from '../lib/date'
import { formatDuration } from '../lib/format'
import { navigate } from '../lib/router'
import { startCustom } from '../lib/session'
import { useStore } from '../lib/store'
import type { Run, Workout } from '../lib/types'
import { distanceValue, formatDistance, formatPace } from '../lib/units'

type Item = { kind: 'workout'; w: Workout; at: string } | { kind: 'run'; r: Run; at: string }
type Filter = 'all' | 'strength' | 'run' | 'mobility'

export function History() {
  const workouts = useStore((s) => s.workouts)
  const runs = useStore((s) => s.runs)
  const units = useStore((s) => s.profile!.units)
  const [filter, setFilter] = useState<Filter>('all')
  const items = useMemo(() => {
    const list: Item[] = [
      ...workouts.filter((w) => w.status !== 'active').map((w) => ({ kind: 'workout' as const, w, at: w.startedAt })),
      ...runs.filter((r) => r.status === 'completed').map((r) => ({ kind: 'run' as const, r, at: r.startedAt })),
    ]
    return list
      .filter((i) => {
        if (filter === 'all') return true
        if (filter === 'run') return i.kind === 'run'
        if (i.kind === 'run') return false
        const k = kindOf(i.w.sessionType)
        return filter === 'mobility' ? k === 'mobility' : k !== 'mobility'
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [workouts, runs, filter])

  const groups = useMemo(() => {
    const g = new Map<string, Item[]>()
    for (const i of items) {
      const d = i.kind === 'workout' ? i.w.date : i.r.date
      const key = parseDay(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      g.set(key, [...(g.get(key) ?? []), i])
    }
    return [...g.entries()]
  }, [items])

  return (
    <Screen back="/train" title="History">
      <Segmented
        value={filter}
        onChange={setFilter}
        className="mb-5"
        options={[
          { value: 'all', label: 'All' },
          { value: 'strength', label: 'Strength' },
          { value: 'run', label: 'Runs' },
          { value: 'mobility', label: 'Mobility' },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState icon="clock" title="Nothing here yet" body="Completed workouts and runs will appear here, with every set and split you log." action={<Button onClick={() => navigate('/')}>Go to today’s session</Button>} />
      ) : (
        <div className="space-y-6">
          {groups.map(([month, list]) => (
            <section key={month}>
              <SectionHeader title={month} />
              <ListGroup>
                {list.map((i) =>
                  i.kind === 'workout' ? (
                    <ListRow
                      key={i.w.id}
                      title={i.w.title}
                      subtitle={`${formatDay(i.w.date)} · ${formatDuration(i.w.activeMs)} · ${workingSets(i.w)} sets${i.w.status === 'ended' ? ' · ended early' : ''}`}
                      right={i.w.records?.some((r) => r.kind !== 'first') ? <Badge tone="accent">PR</Badge> : undefined}
                      onClick={() => navigate(`/history/${i.w.id}`)}
                      icon={KIND_META[kindOf(i.w.sessionType)].icon}
                      iconTone={KIND_META[kindOf(i.w.sessionType)].tone}
                    />
                  ) : (
                    <ListRow
                      key={i.r.id}
                      title={i.r.title}
                      subtitle={`${formatDay(i.r.date)} · ${formatDuration(i.r.activeMs)}${i.r.distanceM ? ` · ${formatDistance(i.r.distanceM, units)} · ${formatPace(runPace(i.r), units)}` : ''}`}
                      onClick={() => navigate(`/run/${i.r.id}`)}
                      icon="run"
                      iconTone="run"
                    />
                  ),
                )}
              </ListGroup>
            </section>
          ))}
        </div>
      )}
    </Screen>
  )
}

export function WorkoutDetail({ id }: { id: string }) {
  const w = useStore((s) => s.workouts.find((x) => x.id === id))
  const [confirm, setConfirm] = useState(false)
  if (!w) return <Screen back="/history" title="Workout"><EmptyState icon="alert" title="Not found" body="This workout may have been deleted." /></Screen>
  const repeat = () => {
    const blocks = w.blocks.map((b) => ({ ...b, exercises: b.exercises.filter((x) => !x.skipped).map((x) => ({ ...x, id: x.id + '_r' + Date.now(), sets: [], effort: undefined, technique: undefined, note: undefined })) }))
    startCustom(newWorkout({ date: dayKey(), sessionType: 'custom', title: `${w.title} (repeat)`, purpose: w.purpose, intensity: w.intensity, blocks, modifiers: [] }))
  }
  return (
    <Screen back="/history" title={w.title} eyebrow={formatDay(w.date, { weekday: 'long', day: 'numeric', month: 'long' })} actions={<IconButton icon="trash" label="Delete workout" variant="ghost" onClick={() => setConfirm(true)} />}>
      <Card className="p-4 grid grid-cols-3 gap-3">
        <Stat label="Time" value={formatDuration(w.activeMs)} />
        <Stat label="Sets" value={workingSets(w)} />
        <Stat label="Effort" value={w.rpe ?? '—'} unit={w.rpe ? '/10' : undefined} />
      </Card>
      {w.modifiers.length > 0 && <p className="text-[13.5px] text-muted mt-3 px-1">{w.modifiers.join(' · ')}</p>}
      <div className="space-y-5 mt-6">
        {w.blocks.map((b, bi) => (
          <section key={bi}>
            <SectionHeader title={b.title} />
            <Card className="divide-y divide-line">
              {b.exercises.map((x) => {
                const ex = getExercise(x.exerciseId)
                return (
                  <div key={x.id} className="p-4">
                    <div className="flex items-center gap-2">
                      <button type="button" className="flex-1 text-left font-semibold" onClick={() => navigate(`/library/${x.exerciseId}`)}>
                        {ex?.name ?? x.exerciseId}
                      </button>
                      {x.skipped && <Badge>Skipped</Badge>}
                      {x.originalExerciseId && <Badge tone="calm">Swapped</Badge>}
                    </div>
                    <div className="text-[14px] text-muted mt-1 num">
                      {x.sets.length ? x.sets.map(valueOf).join(' · ') : 'No sets logged'}
                      {x.sets.length > 0 && (ex?.metric === 'time' ? ' s' : ex?.metric === 'distance' ? ' m' : ' reps')}
                      {(x.targetReps ?? x.targetSeconds) && ` · target ${x.targetReps ?? x.targetSeconds}`}
                    </div>
                    {x.note && <p className="text-[13.5px] mt-1">{x.note}</p>}
                  </div>
                )
              })}
            </Card>
          </section>
        ))}
      </div>
      {w.notes && (
        <Card className="p-4 mt-5">
          <div className="text-[13px] text-muted font-semibold uppercase tracking-[0.06em] mb-1">Notes</div>
          <p>{w.notes}</p>
        </Card>
      )}
      <Button size="lg" block className="mt-6" icon="reset" onClick={repeat}>
        Repeat this workout
      </Button>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title="Delete this workout?" body="It will be removed from your history and charts. This can’t be undone." confirmLabel="Delete" danger onConfirm={() => (deleteWorkout(w.id), navigate('/history', { replace: true }))} />
    </Screen>
  )
}

function splits(r: Run) {
  const out: number[] = []
  let d = 0
  let lastMark = r.points[0]?.t
  let prev: Run['points'][number] | undefined
  for (const p of r.points) {
    if (p.acc > MAX_ACCURACY_M) continue
    d += gpsIncrement(prev, p)
    prev = p
    if (d >= (out.length + 1) * 1000 && lastMark) {
      out.push((p.t - lastMark) / 1000)
      lastMark = p.t
    }
  }
  return out
}

function RouteTrace({ r }: { r: Run }) {
  const pts = r.points.filter((p) => p.acc <= MAX_ACCURACY_M)
  if (pts.length < 3) return null
  const lats = pts.map((p) => p.lat)
  const lons = pts.map((p) => p.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const w = (maxLon - minLon) * k || 1e-6
  const h = maxLat - minLat || 1e-6
  const s = 300 / Math.max(w, h)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(10 + (p.lon - minLon) * k * s).toFixed(1)},${(10 + (maxLat - p.lat) * s).toFixed(1)}`).join(' ')
  return (
    <Card className="p-3">
      <svg viewBox={`0 0 ${20 + w * s} ${20 + h * s}`} className="w-full max-h-[260px]" role="img" aria-label="Route shape">
        <path d={d} fill="none" stroke="var(--run)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={10 + (pts[0].lon - minLon) * k * s} cy={10 + (maxLat - pts[0].lat) * s} r={5} fill="var(--accent)" />
      </svg>
      <p className="text-[12px] text-faint text-center mt-1">Route shape from GPS. No map tiles are loaded, so it works offline and nothing is sent anywhere.</p>
    </Card>
  )
}

export function RunDetail({ id }: { id: string }) {
  const r = useStore((s) => s.runs.find((x) => x.id === id))
  const all = useStore((s) => s.runs)
  const units = useStore((s) => s.profile!.units)
  const [confirm, setConfirm] = useState(false)
  if (!r) return <Screen back="/train" title="Run"><EmptyState icon="alert" title="Not found" body="This run may have been deleted." /></Screen>
  const hits = runRecordHits(r, all.filter((x) => x.startedAt < r.startedAt))
  const sp = r.source === 'gps' ? splits(r) : []
  return (
    <Screen back="/history" title={r.title} eyebrow={formatDay(r.date, { weekday: 'long', day: 'numeric', month: 'long' })} actions={<IconButton icon="trash" label="Delete run" variant="ghost" onClick={() => setConfirm(true)} />}>
      <Card className="p-5 grid grid-cols-3 gap-3">
        <Stat label="Distance" value={r.distanceM ? distanceValue(r.distanceM, units).toFixed(2) : '—'} unit={r.distanceM ? units.distance : undefined} />
        <Stat label="Time" value={formatDuration(r.activeMs)} />
        <Stat label="Pace" value={formatPace(runPace(r), units).split(' ')[0]} unit={runPace(r) ? `/${units.distance}` : undefined} />
      </Card>
      <div className="flex flex-wrap gap-1.5 mt-3">
        <Badge>{r.source === 'gps' ? 'GPS' : r.source === 'timer' ? 'Timer' : 'Manual entry'}</Badge>
        {r.feel && <Badge tone={r.feel === 'hard' ? 'warn' : r.feel === 'easy' ? 'accent' : 'neutral'}>Felt {r.feel === 'hard' ? 'difficult' : r.feel}</Badge>}
        {r.rpe && <Badge>Effort {r.rpe}/10</Badge>}
        {r.plan && <Badge tone={r.completedPlan === false ? 'warn' : 'accent'}>{r.completedPlan === false ? 'Cut short' : 'Plan completed'}</Badge>}
        {hits.map((h) => (
          <Badge key={h} tone="accent">
            {h}
          </Badge>
        ))}
      </div>
      {r.bestKmSec && <p className="text-[14px] text-muted mt-3 px-1">Fastest kilometre within this run: <span className="num text-ink font-semibold">{formatDuration(r.bestKmSec * 1000)}</span></p>}
      {sp.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="Kilometre splits" />
          <Card className="divide-y divide-line">
            {sp.map((s, i) => {
              const best = Math.min(...sp)
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-8 text-muted num">{i + 1}</span>
                  <div className="flex-1 h-2 rounded-full bg-raised overflow-hidden">
                    <div className="h-full bg-run rounded-full" style={{ width: `${(best / s) * 100}%` }} />
                  </div>
                  <span className="num font-semibold w-14 text-right">{formatDuration(s * 1000)}</span>
                </div>
              )
            })}
          </Card>
        </section>
      )}
      {r.source === 'gps' && (
        <section className="mt-6">
          <RouteTrace r={r} />
        </section>
      )}
      {r.notes && (
        <Card className="p-4 mt-5">
          <div className="text-[13px] text-muted font-semibold uppercase tracking-[0.06em] mb-1">Notes</div>
          <p>{r.notes}</p>
        </Card>
      )}
      <Button size="lg" block variant="secondary" className="mt-6" onClick={() => navigate('/library/routine/post-run')}>
        Post-run stretches
      </Button>
      <Button size="lg" block variant="ghost" className="mt-2" onClick={() => navigate('/', { replace: true })}>
        Done
      </Button>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title="Delete this run?" body="It will be removed from your history, records and charts." confirmLabel="Delete" danger onConfirm={() => (deleteRun(r.id), navigate('/history', { replace: true }))} />
    </Screen>
  )
}
