import { addDays, dayKey, diffDays, mondayOf, weekDays, weekdayOf } from '../lib/date'
import type { DayKey, Goal, Profile, Programme, Run, SessionType, Weekday, Workout } from '../lib/types'

export const SESSION_INFO: Record<SessionType, { label: string; short: string; load: number; hard: boolean; kind: 'strength' | 'run' | 'conditioning' | 'mobility' | 'rest' }> = {
  'strength-a': { label: 'Strength A · Full body', short: 'Strength A', load: 3, hard: true, kind: 'strength' },
  'strength-b': { label: 'Strength B · Full body', short: 'Strength B', load: 3, hard: true, kind: 'strength' },
  'strength-c': { label: 'Strength C · Power & legs', short: 'Strength C', load: 3, hard: true, kind: 'strength' },
  'run-easy': { label: 'Easy run', short: 'Easy run', load: 1.5, hard: false, kind: 'run' },
  'run-quality': { label: 'Quality run', short: 'Quality run', load: 3, hard: true, kind: 'run' },
  'run-long': { label: 'Long easy run', short: 'Long run', load: 2.5, hard: false, kind: 'run' },
  conditioning: { label: 'Outdoor conditioning', short: 'Conditioning', load: 2, hard: false, kind: 'conditioning' },
  mobility: { label: 'Mobility & recovery', short: 'Mobility', load: 0.5, hard: false, kind: 'mobility' },
  rest: { label: 'Rest day', short: 'Rest', load: 0, hard: false, kind: 'rest' },
}

export function isRunSession(t: SessionType) {
  return SESSION_INFO[t].kind === 'run'
}

// ───────────── Weekly composition ─────────────

/** Decide which sessions a week contains, given availability and goals. */
export function weeklySessions(dayCount: number, goals: Goal[], runLevel: Profile['runLevel'], avoidRunning: boolean): SessionType[] {
  const n = Math.min(6, Math.max(1, dayCount)) // always keep at least one full rest day
  const endurance = goals.includes('endurance')
  const strengthFocus = goals.includes('muscle') || goals.includes('strength')
  const runner = !avoidRunning
  const canQuality = runLevel === 'fivek' || runLevel === 'tenk' || runLevel === 'continuous20'

  let s: SessionType[]
  switch (n) {
    case 1:
      s = ['strength-a']
      break
    case 2:
      s = runner ? ['strength-a', 'run-easy'] : ['strength-a', 'strength-b']
      break
    case 3:
      s = runner ? (endurance ? ['strength-a', 'run-easy', 'run-long'] : ['strength-a', 'strength-b', 'run-easy']) : ['strength-a', 'strength-b', 'conditioning']
      break
    case 4:
      s = runner ? ['strength-a', 'strength-b', 'run-easy', canQuality ? 'run-quality' : 'run-long'] : ['strength-a', 'strength-b', 'strength-c', 'conditioning']
      break
    case 5:
      s = runner
        ? endurance && !strengthFocus
          ? ['strength-a', 'strength-b', 'run-easy', canQuality ? 'run-quality' : 'run-easy', 'run-long']
          : ['strength-a', 'strength-b', 'strength-c', 'run-easy', canQuality ? 'run-quality' : 'run-long']
        : ['strength-a', 'strength-b', 'strength-c', 'conditioning', 'mobility']
      break
    default:
      s = runner
        ? ['strength-a', 'strength-b', 'strength-c', 'run-easy', canQuality ? 'run-quality' : 'run-long', 'mobility']
        : ['strength-a', 'strength-b', 'strength-c', 'conditioning', 'mobility', 'mobility']
  }
  if (goals.includes('mobility') && n >= 4 && !s.includes('mobility')) s[s.length - 1] = 'mobility'
  return s
}

// ───────────── Load model ─────────────

export interface LoadIssue {
  day: number // index into the week (0 = Monday)
  severity: 'warn' | 'block'
  message: string
}

/** Score a 7-day arrangement. Lower is better. Also explains each issue for the UI. */
export function evaluateWeek(week: (SessionType | undefined)[], lightened: boolean[] = []): { score: number; issues: LoadIssue[] } {
  let score = 0
  const issues: LoadIssue[] = []
  const t = (i: number) => week[i] ?? 'rest'
  const hard = (i: number) => SESSION_INFO[t(i)].hard && !lightened[i]
  for (let i = 1; i < 7; i++) {
    const a = t(i - 1)
    const b = t(i)
    if (hard(i - 1) && hard(i)) {
      score += 10
      issues.push({ day: i, severity: 'block', message: `${SESSION_INFO[b].short} the day after ${SESSION_INFO[a].short}: two hard days in a row` })
    } else if (a === b && a !== 'rest' && a !== 'mobility') {
      score += 6
      issues.push({ day: i, severity: 'warn', message: `${SESSION_INFO[a].short} on consecutive days` })
    } else if (SESSION_INFO[a].kind === 'strength' && b === 'run-long') {
      score += 2
    }
    if (SESSION_INFO[a].load + SESSION_INFO[b].load > 5) score += 2
  }
  for (let i = 2; i < 7; i++) {
    if ([i - 2, i - 1, i].every((j) => SESSION_INFO[t(j)].load >= 1.5)) {
      score += 3
      issues.push({ day: i, severity: 'warn', message: 'Three training days in a row; keep at least one of them easy' })
    }
  }
  // Prefer strength sessions spread out across the week.
  const strengthDays = week.map((x, i) => (x && SESSION_INFO[x].kind === 'strength' ? i : -1)).filter((i) => i >= 0)
  for (let i = 1; i < strengthDays.length; i++) if (strengthDays[i] - strengthDays[i - 1] < 2) score += 1
  return { score, issues }
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const out: T[][] = []
  const seen = new Set<string>()
  items.forEach((item, i) => {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) {
      const p = [item, ...rest]
      const key = p.join('|')
      if (!seen.has(key)) {
        seen.add(key)
        out.push(p)
      }
    }
  })
  return out
}

/** Place sessions on the user's chosen days with the least consecutive-day load. */
export function arrangeWeek(days: Weekday[], sessions: SessionType[]): Partial<Record<Weekday, SessionType>> {
  const sortedDays = [...days].sort((a, b) => a - b).slice(0, sessions.length)
  let best: SessionType[] = sessions
  let bestScore = Infinity
  for (const perm of permutations(sessions)) {
    const week: (SessionType | undefined)[] = Array(7).fill(undefined)
    sortedDays.forEach((d, i) => (week[d] = perm[i]))
    // Prefer the long run at the weekend if possible.
    let { score } = evaluateWeek(week)
    // Sunday → next Monday is also consecutive.
    if (week[6] && week[0] && SESSION_INFO[week[6]].hard && SESSION_INFO[week[0]].hard) score += 8
    const longIdx = week.indexOf('run-long')
    if (longIdx >= 0 && longIdx < 5) score += 0.5
    if (score < bestScore) {
      bestScore = score
      best = perm
    }
  }
  const template: Partial<Record<Weekday, SessionType>> = {}
  sortedDays.forEach((d, i) => (template[d] = best[i]))
  return template
}

// ───────────── Planned day lookup ─────────────

export interface DayPlan {
  date: DayKey
  week: number // 1-based programme week, 0 if before start, > weeks if after end
  type: SessionType
  lighten: boolean
  skipped: boolean
  isDeload: boolean
  moved: boolean
  inProgramme: boolean
}

export function programmeWeek(p: Programme, date: DayKey): number {
  const d = diffDays(date, p.startDate)
  return d < 0 ? 0 : Math.floor(d / 7) + 1
}

export function isDeloadWeek(p: Programme, week: number) {
  return p.deloadWeeks.includes(week) || p.extraDeloadWeeks.includes(week)
}

export function planFor(p: Programme, date: DayKey): DayPlan {
  const week = programmeWeek(p, date)
  const inProgramme = week >= 1 && week <= p.weeks
  const o = p.overrides[date]
  const base = inProgramme ? (p.template[weekdayOf(date)] ?? 'rest') : 'rest'
  const type = o?.type ?? base
  return {
    date,
    week,
    type,
    lighten: !!o?.lighten,
    skipped: !!o?.skipped,
    isDeload: inProgramme && isDeloadWeek(p, week),
    moved: o?.type !== undefined && o.type !== base,
    inProgramme,
  }
}

export function weekPlan(p: Programme, anyDay: DayKey): DayPlan[] {
  return weekDays(mondayOf(anyDay)).map((d) => planFor(p, d))
}

// ───────────── Completion matching ─────────────

export function completedOn(date: DayKey, workouts: Workout[], runs: Run[]) {
  return {
    workouts: workouts.filter((w) => w.date === date && w.status !== 'active'),
    runs: runs.filter((r) => r.date === date && r.status === 'completed'),
  }
}

/** A planned session counts as done if any matching-kind training was logged that day. */
export function isPlanDone(plan: DayPlan, workouts: Workout[], runs: Run[]): boolean {
  if (plan.type === 'rest') return false
  const done = completedOn(plan.date, workouts, runs)
  const kind = SESSION_INFO[plan.type].kind
  if (kind === 'run') return done.runs.length > 0
  return done.workouts.some((w) => w.status === 'completed' || w.blocks.some((b) => b.exercises.some((e) => e.sets.length > 0)))
}

export type DayStatus = 'done' | 'missed' | 'planned' | 'rest' | 'skipped' | 'today'

export function dayStatus(plan: DayPlan, workouts: Workout[], runs: Run[], today: DayKey = dayKey()): DayStatus {
  if (isPlanDone(plan, workouts, runs)) return 'done'
  if (plan.type === 'rest') return 'rest'
  if (plan.skipped) return 'skipped'
  const d = diffDays(plan.date, today)
  if (d < 0) return 'missed'
  if (d === 0) return 'today'
  return 'planned'
}

export function missedThisWeek(p: Programme, workouts: Workout[], runs: Run[], today: DayKey = dayKey()): DayPlan[] {
  return weekPlan(p, today).filter((d) => diffDays(d.date, today) < 0 && dayStatus(d, workouts, runs, today) === 'missed')
}

// ───────────── Rearranging ─────────────

export interface MoveResult {
  ok: boolean
  issues: LoadIssue[]
  overrides: Programme['overrides']
}

/**
 * Swap the sessions on two days of the same week. The set of sessions in the week is
 * preserved, so the programme's balance stays intact. Hard-on-hard placements are blocked
 * unless `lightenSecond` is set, which reduces the later of the two sessions.
 */
export function moveSession(p: Programme, from: DayKey, to: DayKey, lightenSecond = false): MoveResult {
  const a = planFor(p, from)
  const b = planFor(p, to)
  const overrides = { ...p.overrides }
  overrides[from] = { ...overrides[from], type: b.type, lighten: false }
  overrides[to] = { ...overrides[to], type: a.type, lighten: false }

  const monday = mondayOf(to)
  const week = weekDays(monday).map((d) => {
    const o = overrides[d]
    return o?.type ?? (planFor(p, d).inProgramme ? (p.template[weekdayOf(d)] ?? 'rest') : 'rest')
  })
  const lightened = weekDays(monday).map((d) => !!overrides[d]?.lighten)
  let { issues } = evaluateWeek(week, lightened)
  const toIdx = weekdayOf(to)
  const relevant = issues.filter((i) => i.severity === 'block' && Math.abs(i.day - toIdx) <= 1)
  if (relevant.length && lightenSecond) {
    for (const issue of relevant) {
      const later = weekDays(monday)[issue.day]
      overrides[later] = { ...overrides[later], lighten: true, note: 'Lightened to avoid two hard days in a row' }
      lightened[issue.day] = true
    }
    issues = evaluateWeek(week, lightened).issues
  }
  const blocking = issues.filter((i) => i.severity === 'block' && Math.abs(i.day - toIdx) <= 1)
  return { ok: blocking.length === 0, issues, overrides }
}

export function nextTrainingDay(p: Programme, from: DayKey): DayPlan | undefined {
  for (let i = 1; i <= 14; i++) {
    const plan = planFor(p, addDays(from, i))
    if (plan.type !== 'rest' && !plan.skipped) return plan
  }
  return undefined
}
