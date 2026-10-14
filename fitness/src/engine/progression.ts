import { uid } from '../lib/id'
import type { ExerciseLog, Profile, Programme, Recommendation, SlotState, Workout } from '../lib/types'
import { ctxFromProfile, getExercise, nextInTrack } from './library'
import { rangeFor } from './programme'

/**
 * Transparent, rule-based progression (double progression):
 *
 * 1. A session "meets target" when every prescribed set hit the target, technique was not
 *    reported as breaking down, and effort was not reported as maximal.
 * 2. Readiness needs evidence: one session if you reported 3+ reps in reserve ("easy"),
 *    two in a row if "solid", three in a row if you didn't rate effort.
 * 3. Within the rep/hold range the target rises by a small step automatically.
 * 4. At the top of the range, a harder variation (or an extra set) is *recommended*;
 *    you choose whether to accept it.
 * 5. Two sessions in a row well short of target lower the target; at the bottom of the
 *    range an easier variation is recommended.
 */

export interface SessionResult {
  meets: boolean
  short: boolean
  effort?: ExerciseLog['effort']
  technique?: ExerciseLog['technique']
  best: number
}

export function valueOf(set: { reps?: number; seconds?: number }) {
  return set.reps ?? set.seconds ?? 0
}

export function sessionResult(x: ExerciseLog): SessionResult | null {
  if (x.skipped || x.sets.length === 0) return null
  const target = x.targetReps ?? x.targetSeconds
  if (!target) return null
  const vals = x.sets.map(valueOf)
  const best = Math.max(...vals)
  const allHit = x.sets.length >= x.targetSets && vals.every((v) => v >= target)
  const meets = allHit && x.technique !== 'breakdown' && x.effort !== 'max'
  const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, x.targetSets)
  const short = avg < target * 0.8 || x.technique === 'breakdown'
  return { meets, short, effort: x.effort, technique: x.technique, best }
}

/** Most recent logs for this slot+exercise, newest first, including the current one. */
export function slotHistory(workouts: Workout[], slotId: string, exerciseId: string, limit = 4): ExerciseLog[] {
  const out: ExerciseLog[] = []
  const sorted = [...workouts].sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))
  for (const w of sorted) {
    for (const b of w.blocks) {
      if (b.kind !== 'main') continue
      for (const x of b.exercises) if (x.slotId === slotId && x.exerciseId === exerciseId && !x.skipped && x.sets.length) out.push(x)
    }
    if (out.length >= limit) break
  }
  return out
}

function step(slot: SlotState) {
  return slot.metric === 'time' ? 5 : 1
}

export interface Evaluation {
  slot: SlotState
  recommendation?: Recommendation
}

export function evaluateSlot(slot: SlotState, history: ExerciseLog[], profile: Profile): Evaluation {
  const latest = history[0]
  if (!latest || latest.exerciseId !== slot.exerciseId) return { slot }
  // Only judge sessions prescribed at the current target.
  const atTarget = history.filter((x) => (x.targetReps ?? x.targetSeconds) === slot.target)
  const results = atTarget.map(sessionResult).filter((r): r is SessionResult => !!r)
  if (!results.length) return { slot }
  const ctx = ctxFromProfile(profile)
  const ex = getExercise(slot.exerciseId)
  const now = new Date().toISOString()
  const r0 = results[0]

  const needed = r0.effort === 'easy' ? 1 : r0.effort === 'solid' ? 2 : 3
  const streak = results.slice(0, needed)
  const ready = streak.length >= needed && streak.every((r) => r.meets)
  const unitWord = slot.metric === 'time' ? 's hold' : ' reps'

  if (ready) {
    const evidence =
      needed === 1
        ? `you hit ${slot.target}${unitWord} on every set with 3+ reps in reserve`
        : `you hit ${slot.target}${unitWord} on every set ${needed} sessions running${r0.effort ? '' : ' (rate effort after each exercise to progress faster)'}`
    if (slot.target < slot.range[1]) {
      const inc = r0.effort === 'easy' && slot.target + 2 * step(slot) <= slot.range[1] ? 2 * step(slot) : step(slot)
      const to = Math.min(slot.range[1], slot.target + inc)
      return {
        slot: { ...slot, target: to },
        recommendation: {
          id: uid('rec'), createdAt: now, slotId: slot.slotId,
          kind: slot.metric === 'time' ? 'longer-hold' : 'more-reps',
          fromExerciseId: slot.exerciseId, toExerciseId: slot.exerciseId, fromTarget: slot.target, toTarget: to,
          reason: `Target raised to ${to}${unitWord} because ${evidence}.`,
          status: 'auto',
        },
      }
    }
    const harder = nextInTrack(slot.trackId, slot.exerciseId, 1, ctx)
    if (harder) {
      const range = rangeFor(harder)
      return {
        slot,
        recommendation: {
          id: uid('rec'), createdAt: now, slotId: slot.slotId, kind: 'harder-variation',
          fromExerciseId: slot.exerciseId, toExerciseId: harder.id, fromTarget: slot.target, toTarget: range[0],
          reason: `You’ve reached the top of the range for ${ex?.name ?? 'this exercise'}: ${evidence}. Ready to try ${harder.name} at ${range[0]}${harder.metric === 'time' ? 's' : ' reps'}?`,
          status: 'pending',
        },
      }
    }
    if (slot.sets < 4) {
      return {
        slot,
        recommendation: {
          id: uid('rec'), createdAt: now, slotId: slot.slotId, kind: 'add-set',
          fromExerciseId: slot.exerciseId, toExerciseId: slot.exerciseId, fromTarget: slot.target, toTarget: slot.target, toSets: slot.sets + 1,
          reason: `You’re at the top of the range and the hardest variation available to you: ${evidence}. Add a set, or slow the tempo for more challenge.`,
          status: 'pending',
        },
      }
    }
    return { slot }
  }

  const struggling = results.length >= 2 && results.slice(0, 2).every((r) => r.short)
  if (struggling) {
    if (slot.target > slot.range[0]) {
      const to = Math.max(slot.range[0], slot.target - step(slot) * 2)
      return {
        slot: { ...slot, target: to },
        recommendation: {
          id: uid('rec'), createdAt: now, slotId: slot.slotId, kind: 'hold',
          fromExerciseId: slot.exerciseId, toExerciseId: slot.exerciseId, fromTarget: slot.target, toTarget: to,
          reason: `Target eased to ${to}${unitWord}: the last two sessions fell well short of ${slot.target}. Build back with clean reps.`,
          status: 'auto',
        },
      }
    }
    const easier = nextInTrack(slot.trackId, slot.exerciseId, -1, ctx)
    if (easier) {
      const range = rangeFor(easier)
      const to = Math.round((range[0] + range[1]) / 2)
      return {
        slot,
        recommendation: {
          id: uid('rec'), createdAt: now, slotId: slot.slotId, kind: 'easier-variation',
          fromExerciseId: slot.exerciseId, toExerciseId: easier.id, fromTarget: slot.target, toTarget: to,
          reason: `${ex?.name ?? 'This exercise'} has been a real struggle for two sessions. Spending a few weeks on ${easier.name} will build the strength to come back to it.`,
          status: 'pending',
        },
      }
    }
  }
  return { slot }
}

export function applyRecommendation(prog: Programme, rec: Recommendation): Programme {
  const slot = prog.slots[rec.slotId]
  if (!slot) return prog
  const ex = getExercise(rec.toExerciseId)
  if (!ex) return prog
  const range = rangeFor(ex)
  const next: SlotState = {
    ...slot,
    exerciseId: ex.id,
    metric: ex.metric,
    range,
    target: rec.toTarget,
    sets: rec.toSets ?? slot.sets,
  }
  return { ...prog, slots: { ...prog.slots, [rec.slotId]: next } }
}

/** Run after a workout is finished: returns updated slots and any recommendations. */
export function evaluateWorkout(prog: Programme, workout: Workout, allWorkouts: Workout[], profile: Profile) {
  let slots = { ...prog.slots }
  const recs: Recommendation[] = []
  const seen = new Set<string>()
  for (const b of workout.blocks) {
    if (b.kind !== 'main') continue
    for (const x of b.exercises) {
      if (!x.slotId || seen.has(x.slotId) || !slots[x.slotId]) continue
      seen.add(x.slotId)
      const slot = slots[x.slotId]
      if (x.exerciseId !== slot.exerciseId) continue // substituted this session; don't judge
      const hist = slotHistory(allWorkouts, x.slotId, x.exerciseId)
      const ev = evaluateSlot(slot, hist, profile)
      slots = { ...slots, [x.slotId]: ev.slot }
      if (ev.recommendation) recs.push(ev.recommendation)
    }
  }
  return { programme: { ...prog, slots }, recommendations: recs }
}
