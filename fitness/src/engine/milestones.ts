import { TRACKS } from '../data/exercises'
import { addDays, dayKey, diffDays } from '../lib/date'
import type { DayKey, Programme, Run, Workout } from '../lib/types'
import { valueOf } from './progression'
import { programmeWeek } from './schedule'
import { workingSets } from './steps'

export interface MilestoneStatus {
  id: string
  title: string
  detail: string
  achievedOn?: DayKey
  progress?: number // 0..1 towards it
}

interface Ctx {
  workouts: Workout[]
  runs: Run[]
  programme: Programme | null
  today: DayKey
}

function sessionsByDate(c: Ctx): DayKey[] {
  return [
    ...c.workouts.filter((w) => w.status !== 'active' && workingSets(w) > 0).map((w) => w.date),
    ...c.runs.filter((r) => r.status === 'completed').map((r) => r.date),
  ].sort()
}

function firstSetDate(c: Ctx, ids: string[], min: number): DayKey | undefined {
  const sorted = [...c.workouts].filter((w) => w.status !== 'active').sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  for (const w of sorted) for (const b of w.blocks) for (const x of b.exercises) if (ids.includes(x.exerciseId) && x.sets.some((s) => valueOf(s) >= min)) return w.date
  return undefined
}

function bestOf(c: Ctx, ids: string[]): number {
  let best = 0
  for (const w of c.workouts) for (const b of w.blocks) for (const x of b.exercises) if (ids.includes(x.exerciseId)) for (const s of x.sets) best = Math.max(best, valueOf(s))
  return best
}

export function milestones(c: Ctx): MilestoneStatus[] {
  const dates = sessionsByDate(c)
  const count = (n: number): MilestoneStatus => ({
    id: `sessions-${n}`, title: `${n} sessions`, detail: `Complete ${n} training sessions of any kind.`,
    achievedOn: dates[n - 1], progress: Math.min(1, dates.length / n),
  })
  const out: MilestoneStatus[] = [
    { id: 'first', title: 'First session', detail: 'Log your first workout or run.', achievedOn: dates[0], progress: dates.length ? 1 : 0 },
  ]
  const p = c.programme
  if (p) {
    const week = programmeWeek(p, c.today)
    const weekEnd = (w: number) => addDays(p.startDate, w * 7 - 1)
    const passed = (w: number) => (diffDays(c.today, weekEnd(w)) > 0 ? weekEnd(w) : undefined)
    out.push({ id: 'prog-week2', title: 'Two weeks in', detail: 'Complete the first two weeks of your programme.', achievedOn: passed(2), progress: Math.min(1, (week - 1) / 2) })
    if (p.deloadWeeks[0]) out.push({ id: 'prog-deload', title: 'First deload', detail: `Reach the week ${p.deloadWeeks[0]} recovery week.`, achievedOn: diffDays(c.today, addDays(p.startDate, (p.deloadWeeks[0] - 1) * 7)) >= 0 ? addDays(p.startDate, (p.deloadWeeks[0] - 1) * 7) : undefined, progress: Math.min(1, (week - 1) / (p.deloadWeeks[0] - 1)) })
    out.push({ id: 'prog-half', title: 'Halfway', detail: `Reach week ${Math.ceil(p.weeks / 2) + 1} of ${p.weeks}.`, achievedOn: passed(Math.ceil(p.weeks / 2)), progress: Math.min(1, (week - 1) / Math.ceil(p.weeks / 2)) })
    out.push({ id: 'prog-done', title: 'Programme complete', detail: `Finish all ${p.weeks} weeks.`, achievedOn: passed(p.weeks), progress: Math.min(1, (week - 1) / p.weeks) })
  }
  out.push(count(10), count(25), count(50))

  const pushIds = TRACKS.push.exerciseIds
  const fullPush = pushIds.slice(pushIds.indexOf('pushup'))
  out.push({ id: 'pushup-1', title: 'First full push-up', detail: 'Log a set of at least one standard (or harder) push-up.', achievedOn: firstSetDate(c, fullPush, 1), progress: firstSetDate(c, fullPush, 1) ? 1 : 0 })
  out.push({ id: 'pushup-10', title: '10 push-ups in a set', detail: 'Ten standard (or harder) push-ups in one set with good form.', achievedOn: firstSetDate(c, fullPush, 10), progress: Math.min(1, bestOf(c, fullPush) / 10) })
  const plankIds = ['plank', 'long-lever-plank']
  out.push({ id: 'plank-60', title: '60-second plank', detail: 'Hold a full forearm plank for a minute.', achievedOn: firstSetDate(c, plankIds, 60), progress: Math.min(1, bestOf(c, plankIds) / 60) })
  const slIds = TRACKS['single-leg'].exerciseIds.slice(3)
  out.push({ id: 'single-leg', title: 'Single-leg squat', detail: 'Log a skater squat or pistol variation.', achievedOn: firstSetDate(c, slIds, 1), progress: firstSetDate(c, slIds, 1) ? 1 : 0 })

  const runsSorted = [...c.runs].filter((r) => r.status === 'completed').sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const continuous20 = runsSorted.find((r) => r.activeMs >= 20 * 60000 && !(r.plan ?? []).some((s) => s.kind === 'walk'))
  out.push({ id: 'run-20', title: '20 minutes non-stop', detail: 'Run for twenty minutes without walk breaks.', achievedOn: continuous20?.date, progress: Math.min(1, Math.max(0, ...runsSorted.map((r) => r.activeMs / 60000 / 20))) })
  const longest = Math.max(0, ...runsSorted.map((r) => r.distanceM))
  out.push({ id: 'run-5k', title: 'First 5 km', detail: 'Cover 5 km in a single run.', achievedOn: runsSorted.find((r) => r.distanceM >= 5000)?.date, progress: Math.min(1, longest / 5000) })
  out.push({ id: 'run-10k', title: 'First 10 km', detail: 'Cover 10 km in a single run.', achievedOn: runsSorted.find((r) => r.distanceM >= 10000)?.date, progress: Math.min(1, longest / 10000) })
  return out
}

export function nextMilestone(list: MilestoneStatus[]): MilestoneStatus | undefined {
  return list.filter((m) => !m.achievedOn).sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0]
}

export function todayKey() {
  return dayKey()
}
