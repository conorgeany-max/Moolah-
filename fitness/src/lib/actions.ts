import { applyRecommendation, evaluateWorkout } from '../engine/progression'
import { createProgramme } from '../engine/programme'
import { recordHits } from '../engine/records'
import { afterRunWalk, bestKilometreSec, reviewRunWeek } from '../engine/running'
import { isRunSession, moveSession, planFor, programmeWeek, isDeloadWeek } from '../engine/schedule'
import { elapsedMs } from '../engine/steps'
import { addDays, dayKey, diffDays } from './date'
import { clearEverything, deleteKV, deleteRecord, putKV, putRecord, putRecords, type Collection } from './db'
import { uid } from './id'
import { DEFAULT_SETTINGS, getState, setState } from './store'
import type { CheckIn, DayKey, DayOverride, Measurement, Metric, Profile, Programme, Recommendation, Run, Settings, Workout } from './types'

/** Every write updates memory first (so the UI is instant), then persists. */
function persistError(e: unknown) {
  console.error('Persist failed', e)
  setState({ error: 'Could not save to this device’s storage. Your latest change may not survive a reload.' })
}

function saveList<K extends Collection>(c: K, record: { id: string }) {
  putRecord(c, record).catch(persistError)
}

// ───────────── Profile & settings ─────────────

export function saveProfile(profile: Profile) {
  const p = { ...profile, updatedAt: new Date().toISOString() }
  setState({ profile: p })
  putKV('profile', p).catch(persistError)
}

export function completeOnboarding(profile: Profile) {
  const now = new Date().toISOString()
  const p: Profile = { ...profile, createdAt: profile.createdAt || now, onboardedAt: now, updatedAt: now }
  const programme = createProgramme(p)
  setState({ profile: p, programme })
  putKV('profile', p).catch(persistError)
  putKV('programme', programme).catch(persistError)
}

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...getState().settings, ...patch }
  setState({ settings })
  putKV('settings', settings).catch(persistError)
  if (patch.theme) {
    try {
      localStorage.setItem('forge:theme', patch.theme)
    } catch {
      /* ignore */
    }
  }
}

// ───────────── Programme ─────────────

export function saveProgramme(programme: Programme) {
  setState({ programme })
  putKV('programme', programme).catch(persistError)
}

/** Rebuild the schedule from the profile; keeps exercise levels and running progress. */
export function regenerateProgramme(opts: { keepLevels: boolean; restart?: boolean }) {
  const { profile, programme } = getState()
  if (!profile) return
  const next = createProgramme(profile, dayKey(), opts.keepLevels && programme ? programme : undefined)
  if (programme && !opts.restart) {
    // Keep the original start date so week numbers and history stay meaningful.
    next.startDate = programme.startDate
    next.firstDay = programme.firstDay
    next.weeks = Math.max(programme.weeks, next.weeks)
    next.deloadWeeks = programme.deloadWeeks
    next.extraDeloadWeeks = programme.extraDeloadWeeks
    next.overrides = Object.fromEntries(Object.entries(programme.overrides).filter(([d]) => d < dayKey()))
    next.run = programme.run
  }
  saveProgramme(next)
}

export function setOverride(date: DayKey, o: DayOverride | null) {
  const p = getState().programme
  if (!p) return
  const overrides = { ...p.overrides }
  if (o) overrides[date] = { ...overrides[date], ...o }
  else delete overrides[date]
  saveProgramme({ ...p, overrides })
}

export function applyMove(from: DayKey, to: DayKey, lighten: boolean) {
  const p = getState().programme
  if (!p) return { ok: false, issues: [] }
  const r = moveSession(p, from, to, lighten)
  if (r.ok) saveProgramme({ ...p, overrides: r.overrides })
  return r
}

/** Do a missed session today; today's own session is marked as skipped to keep weekly load sensible. */
export function catchUpMissed(missedDate: DayKey) {
  const p = getState().programme
  if (!p) return
  const missed = planFor(p, missedDate)
  const today = dayKey()
  const todayPlan = planFor(p, today)
  const overrides = { ...p.overrides }
  overrides[missedDate] = { ...overrides[missedDate], skipped: true, note: `Moved to ${today}` }
  overrides[today] = { type: missed.type, note: todayPlan.type !== 'rest' ? `Replaces ${todayPlan.type} (caught up a missed session)` : 'Caught up a missed session' }
  saveProgramme({ ...p, overrides })
}

export function takeDeloadThisWeek() {
  const p = getState().programme
  if (!p) return
  const w = programmeWeek(p, dayKey())
  if (isDeloadWeek(p, w)) return
  saveProgramme({ ...p, extraDeloadWeeks: [...p.extraDeloadWeeks, w] })
}

// ───────────── Workouts ─────────────

export function saveWorkout(w: Workout) {
  setState((s) => ({ workouts: [w, ...s.workouts.filter((x) => x.id !== w.id)] }))
  saveList('workouts', w)
}

export function startWorkout(w: Workout) {
  const existing = getState().workouts.find((x) => x.status === 'active')
  if (existing && existing.id !== w.id) discardWorkout(existing.id)
  saveWorkout({ ...w, status: 'active', startedAt: new Date().toISOString(), runningSince: Date.now(), activeMs: 0 })
}

export function discardWorkout(id: string) {
  setState((s) => ({ workouts: s.workouts.filter((x) => x.id !== id) }))
  deleteRecord('workouts', id).catch(persistError)
}

export function deleteWorkout(id: string) {
  discardWorkout(id)
}

export interface FinishResult {
  workout: Workout
  recommendations: Recommendation[]
}

export function finishWorkout(id: string, info: Pick<Workout, 'rpe' | 'feel' | 'notes'>, ended = false): FinishResult | null {
  const s = getState()
  const w = s.workouts.find((x) => x.id === id)
  if (!w) return null
  const now = Date.now()
  const done: Workout = {
    ...w,
    ...info,
    status: ended ? 'ended' : 'completed',
    completedAt: new Date(now).toISOString(),
    activeMs: elapsedMs(w, now),
    runningSince: null,
    rest: null,
  }
  done.records = recordHits(done, s.workouts.filter((x) => x.id !== id && x.status !== 'active'))
  saveWorkout(done)

  let recs: Recommendation[] = []
  if (s.programme && s.profile) {
    const all = getState().workouts
    const r = evaluateWorkout(s.programme, done, all, s.profile)
    recs = r.recommendations
    saveProgramme(r.programme)
    if (recs.length) {
      // Replace stale pending recommendations for the same slot.
      const slotIds = new Set(recs.map((x) => x.slotId))
      const stale = getState().recommendations.filter((x) => x.status === 'pending' && slotIds.has(x.slotId))
      const updatedStale = stale.map((x) => ({ ...x, status: 'dismissed' as const }))
      setState((st) => ({ recommendations: [...recs, ...st.recommendations.map((x) => updatedStale.find((u) => u.id === x.id) ?? x)] }))
      putRecords('recommendations', [...recs, ...updatedStale]).catch(persistError)
    }
  }
  return { workout: done, recommendations: recs }
}

export function acceptRecommendation(id: string) {
  const s = getState()
  const rec = s.recommendations.find((r) => r.id === id)
  if (!rec || !s.programme) return
  saveProgramme(applyRecommendation(s.programme, rec))
  const updated = { ...rec, status: 'accepted' as const }
  setState((st) => ({ recommendations: st.recommendations.map((r) => (r.id === id ? updated : r)) }))
  saveList('recommendations', updated)
}

export function dismissRecommendation(id: string) {
  const rec = getState().recommendations.find((r) => r.id === id)
  if (!rec) return
  const updated = { ...rec, status: 'dismissed' as const }
  setState((st) => ({ recommendations: st.recommendations.map((r) => (r.id === id ? updated : r)) }))
  saveList('recommendations', updated)
}

/** Manually set a track's exercise (e.g. from the library "use in my programme"). */
export function setSlotExercise(slotId: string, exerciseId: string, target: number, range: [number, number], metric: Metric) {
  const p = getState().programme
  if (!p || !p.slots[slotId]) return
  saveProgramme({ ...p, slots: { ...p.slots, [slotId]: { ...p.slots[slotId], exerciseId, target, range, metric } } })
}

// ───────────── Runs ─────────────

let lastRunPersist = 0
export function saveRun(r: Run, opts: { throttle?: boolean } = {}) {
  setState((s) => ({ runs: [r, ...s.runs.filter((x) => x.id !== r.id)] }))
  const now = Date.now()
  if (opts.throttle && now - lastRunPersist < 4000) return
  lastRunPersist = now
  saveList('runs', r)
}

export function discardRun(id: string) {
  setState((s) => ({ runs: s.runs.filter((x) => x.id !== id) }))
  deleteRecord('runs', id).catch(persistError)
}

export function finishRun(id: string, info: Pick<Run, 'feel' | 'rpe' | 'notes' | 'completedPlan'>): { run: Run; message?: string } | null {
  const s = getState()
  const r = s.runs.find((x) => x.id === id)
  if (!r) return null
  const now = Date.now()
  const done: Run = {
    ...r,
    ...info,
    status: 'completed',
    completedAt: new Date(now).toISOString(),
    activeMs: elapsedMs(r, now),
    runningSince: null,
    bestKmSec: r.source === 'gps' ? bestKilometreSec(r.points) : undefined,
  }
  saveRun(done)
  return { run: done, message: progressRunning(done) }
}

export function addManualRun(r: Omit<Run, 'id' | 'status' | 'points' | 'runningSince' | 'startedAt' | 'completedAt'> & { startedAt?: string }) {
  const startedAt = r.startedAt ?? new Date(`${r.date}T12:00:00`).toISOString()
  const run: Run = {
    ...r,
    id: uid('run'),
    status: 'completed',
    points: [],
    runningSince: null,
    startedAt,
    completedAt: new Date(Date.parse(startedAt) + r.activeMs).toISOString(),
  }
  saveRun(run)
  return { run, message: progressRunning(run) }
}

export function deleteRun(id: string) {
  discardRun(id)
}

/** Apply running progression after a logged run, plus the weekly review. */
function progressRunning(run: Run): string | undefined {
  const s = getState()
  const p = s.programme
  const t = run.sessionType
  if (!p || t === 'manual' || t === 'free' || !isRunSession(t)) return undefined
  let rs = p.run
  const messages: string[] = []
  if (rs.runWalkStage >= 0) {
    const r = afterRunWalk(rs, run)
    rs = r.run
    if (r.message) messages.push(r.message)
  }
  saveProgramme({ ...p, run: rs })
  return messages.join(' ') || undefined
}

/** Weekly running review: runs once per completed programme week. */
export function reviewPreviousWeek() {
  const s = getState()
  const p = s.programme
  if (!p) return undefined
  const week = programmeWeek(p, dayKey()) - 1
  if (week < 1 || week <= p.run.reviewedWeek) return undefined
  const monday = addDays(p.startDate, (week - 1) * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const planned = days.map((d) => planFor(p, d)).filter((d) => isRunSession(d.type) && !d.skipped).length
  const runs = s.runs.filter((r) => r.status === 'completed' && diffDays(r.date, monday) >= 0 && diffDays(r.date, monday) < 7)
  const res = reviewRunWeek(p, runs, planned, week, isDeloadWeek(p, week))
  saveProgramme({ ...p, run: res.run })
  return res.message
}

// ───────────── Check-ins & measurements ─────────────

export function saveCheckIn(c: Omit<CheckIn, 'id' | 'createdAt'>) {
  const existing = getState().checkIns.find((x) => x.date === c.date)
  const rec: CheckIn = { ...c, id: existing?.id ?? uid('ci'), createdAt: new Date().toISOString() }
  setState((s) => ({ checkIns: [rec, ...s.checkIns.filter((x) => x.id !== rec.id)] }))
  saveList('checkIns', rec)
  return rec
}

export function addMeasurement(m: Omit<Measurement, 'id' | 'createdAt'>) {
  const rec: Measurement = { ...m, id: uid('m'), createdAt: new Date().toISOString() }
  setState((s) => ({ measurements: [rec, ...s.measurements] }))
  saveList('measurements', rec)
}

export function deleteMeasurement(id: string) {
  setState((s) => ({ measurements: s.measurements.filter((x) => x.id !== id) }))
  deleteRecord('measurements', id).catch(persistError)
}

// ───────────── Data management ─────────────

export async function deleteAllData() {
  await clearEverything()
  await deleteKV('profile').catch(() => undefined)
  try {
    localStorage.removeItem('forge:theme')
  } catch {
    /* ignore */
  }
  setState({
    profile: null,
    programme: null,
    settings: DEFAULT_SETTINGS,
    workouts: [],
    runs: [],
    checkIns: [],
    measurements: [],
    recommendations: [],
    customExercises: [],
  })
}
