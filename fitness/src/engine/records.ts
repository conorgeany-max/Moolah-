import type { RecordHit, Run, Workout } from '../lib/types'
import { getExercise } from './library'
import { valueOf } from './progression'

export interface ExerciseBest {
  exerciseId: string
  best: number
  date: string
  metric: 'reps' | 'time' | 'distance'
}

function bestInWorkout(w: Workout): Map<string, number> {
  const m = new Map<string, number>()
  for (const b of w.blocks) {
    if (b.kind !== 'main' && b.kind !== 'finisher') continue
    for (const x of b.exercises) {
      for (const s of x.sets) {
        const v = valueOf(s)
        if (v > (m.get(x.exerciseId) ?? 0)) m.set(x.exerciseId, v)
      }
    }
  }
  return m
}

/** Best single set (reps) or longest single hold per exercise variation. */
export function exerciseBests(workouts: Workout[]): Map<string, ExerciseBest> {
  const out = new Map<string, ExerciseBest>()
  for (const w of workouts) {
    if (w.status === 'active') continue
    for (const [id, v] of bestInWorkout(w)) {
      const prev = out.get(id)
      if (!prev || v > prev.best) out.set(id, { exerciseId: id, best: v, date: w.date, metric: getExercise(id)?.metric ?? 'reps' })
    }
  }
  return out
}

/**
 * A genuine personal record is a better single set or a longer single hold of the *same*
 * variation. More total volume in a session is reported separately and never as a PR.
 */
export function recordHits(workout: Workout, previous: Workout[]): RecordHit[] {
  const bests = exerciseBests(previous.filter((w) => w.id !== workout.id))
  const hits: RecordHit[] = []
  for (const [id, v] of bestInWorkout(workout)) {
    const ex = getExercise(id)
    if (!ex || ex.category === 'mobility' || ex.category === 'stretch' || v <= 0) continue
    const prev = bests.get(id)
    if (!prev) hits.push({ exerciseId: id, kind: 'first', value: v })
    else if (v > prev.best) hits.push({ exerciseId: id, kind: ex.metric === 'time' ? 'hold' : 'reps', value: v, previous: prev.best })
  }
  return hits
}

export interface RunRecords {
  longestDistance?: Run
  longestDuration?: Run
  fastestPace?: { run: Run; secPerKm: number } // whole-run average over ≥ 3 km
  fastestKm?: { run: Run; sec: number } // best 1 km within a GPS track
}

export function runPace(r: Run): number | undefined {
  if (r.distanceM < 200 || r.activeMs <= 0) return undefined
  return r.activeMs / 1000 / (r.distanceM / 1000)
}

export function runRecords(runs: Run[]): RunRecords {
  const rec: RunRecords = {}
  for (const r of runs) {
    if (r.status !== 'completed') continue
    if (r.distanceM > 0 && (!rec.longestDistance || r.distanceM > rec.longestDistance.distanceM)) rec.longestDistance = r
    if (!rec.longestDuration || r.activeMs > rec.longestDuration.activeMs) rec.longestDuration = r
    const p = runPace(r)
    if (p && r.distanceM >= 3000 && (!rec.fastestPace || p < rec.fastestPace.secPerKm)) rec.fastestPace = { run: r, secPerKm: p }
    if (r.bestKmSec && (!rec.fastestKm || r.bestKmSec < rec.fastestKm.sec)) rec.fastestKm = { run: r, sec: r.bestKmSec }
  }
  return rec
}

export function runRecordHits(run: Run, previous: Run[]): string[] {
  const before = runRecords(previous.filter((r) => r.id !== run.id))
  const hits: string[] = []
  if (!previous.some((r) => r.status === 'completed' && r.id !== run.id)) return ['First run logged']
  if (run.distanceM > 0 && run.distanceM > (before.longestDistance?.distanceM ?? 0)) hits.push('Longest run by distance')
  if (run.activeMs > (before.longestDuration?.activeMs ?? 0)) hits.push('Longest run by time')
  const p = runPace(run)
  if (p && run.distanceM >= 3000 && (!before.fastestPace || p < before.fastestPace.secPerKm)) hits.push('Fastest average pace (3 km+)')
  if (run.bestKmSec && (!before.fastestKm || run.bestKmSec < before.fastestKm.sec)) hits.push('Fastest kilometre')
  return hits
}
