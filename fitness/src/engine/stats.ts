import { TRACKS } from '../data/exercises'
import { addDays, dayKey, diffDays, mondayOf } from '../lib/date'
import type { DayKey, Programme, Run, TrackId, Workout } from '../lib/types'
import { getExercise } from './library'
import { valueOf } from './progression'
import { runPace } from './records'
import { dayStatus, planFor } from './schedule'
import { workingSets } from './steps'

export interface WeekStat {
  monday: DayKey
  sessions: number
  workingSets: number
  runDistanceM: number
  runMinutes: number
  strengthSessions: number
  runs: number
}

export function weeklyStats(workouts: Workout[], runs: Run[], weeks = 8, today: DayKey = dayKey()): WeekStat[] {
  const thisMonday = mondayOf(today)
  const out: WeekStat[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = addDays(thisMonday, -7 * i)
    const inWeek = (d: DayKey) => {
      const x = diffDays(d, monday)
      return x >= 0 && x < 7
    }
    const ws = workouts.filter((w) => w.status !== 'active' && inWeek(w.date) && workingSets(w) > 0)
    const rs = runs.filter((r) => r.status === 'completed' && inWeek(r.date))
    out.push({
      monday,
      sessions: ws.length + rs.length,
      strengthSessions: ws.length,
      runs: rs.length,
      workingSets: ws.reduce((a, w) => a + workingSets(w), 0),
      runDistanceM: rs.reduce((a, r) => a + r.distanceM, 0),
      runMinutes: rs.reduce((a, r) => a + r.activeMs / 60000, 0),
    })
  }
  return out
}

export interface Consistency {
  planned: number
  done: number
  rate: number // 0..1
}

/** Completion rate of planned sessions from programme start to yesterday (today counts if done). */
export function consistency(p: Programme, workouts: Workout[], runs: Run[], today: DayKey = dayKey()): Consistency {
  let planned = 0
  let done = 0
  const days = Math.min(diffDays(today, p.startDate), p.weeks * 7 - 1)
  for (let i = 0; i <= days; i++) {
    const d = addDays(p.startDate, i)
    const plan = planFor(p, d)
    if (plan.type === 'rest') continue
    const st = dayStatus(plan, workouts, runs, today)
    if (st === 'today') continue
    if (st === 'skipped') continue
    planned++
    if (st === 'done') done++
  }
  return { planned, done, rate: planned ? done / planned : 0 }
}

export interface TrendPoint {
  date: DayKey
  value: number
  exerciseId: string
  label: string
  level: number // index in track, used to show variation changes
}

/** Best set per session for every variation in a track, so variation changes are visible. */
export function trackTrend(workouts: Workout[], trackId: TrackId): TrendPoint[] {
  const ids = TRACKS[trackId].exerciseIds
  const pts: TrendPoint[] = []
  const sorted = [...workouts].filter((w) => w.status !== 'active').sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  for (const w of sorted) {
    for (const b of w.blocks) {
      if (b.kind !== 'main') continue
      for (const x of b.exercises) {
        const level = ids.indexOf(x.exerciseId)
        if (level < 0 || !x.sets.length) continue
        pts.push({ date: w.date, value: Math.max(...x.sets.map(valueOf)), exerciseId: x.exerciseId, label: getExercise(x.exerciseId)?.name ?? x.exerciseId, level })
      }
    }
  }
  return pts
}

export function paceTrend(runs: Run[]) {
  return [...runs]
    .filter((r) => r.status === 'completed' && r.distanceM >= 800)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((r) => ({ date: r.date, secPerKm: runPace(r)!, distanceM: r.distanceM, run: r }))
    .filter((x) => x.secPerKm)
}

export function daysSinceLastTraining(workouts: Workout[], runs: Run[], today: DayKey = dayKey()): number | undefined {
  const dates = [
    ...workouts.filter((w) => w.status !== 'active' && workingSets(w) > 0).map((w) => w.date),
    ...runs.filter((r) => r.status === 'completed').map((r) => r.date),
  ].filter((d) => d < today)
  if (!dates.length) return undefined
  const last = dates.sort().at(-1)!
  return diffDays(today, last)
}
