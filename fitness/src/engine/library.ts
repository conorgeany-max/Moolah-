import { EXERCISES, EXERCISE_MAP, TRACKS } from '../data/exercises'
import type { AvoidTag, Environment, Equipment, Exercise, Profile, TrackId } from '../lib/types'

let custom: Exercise[] = []
/** Custom exercises are registered by the store so lookups can include them. */
export function registerCustomExercises(list: Exercise[]) {
  custom = list
}

export function allExercises(): Exercise[] {
  return custom.length ? [...EXERCISES, ...custom] : EXERCISES
}

export function getExercise(id: string): Exercise | undefined {
  return EXERCISE_MAP[id] ?? custom.find((c) => c.id === id)
}

export function mustGetExercise(id: string): Exercise {
  const ex = getExercise(id)
  if (!ex) throw new Error(`Unknown exercise: ${id}`)
  return ex
}

/** Which training environments make each equipment requirement available. */
const EQUIPMENT_SOURCES: Record<Equipment, Environment[] | 'always'> = {
  none: 'always',
  wall: ['wall', 'backyard', 'street', 'park'],
  'stable-surface': ['park', 'backyard', 'street', 'stairs'],
  step: ['stairs', 'street', 'park', 'backyard'],
  hill: ['hills'],
  stairs: ['stairs'],
  bar: ['bar'],
  'low-bar': ['bar'],
}

export interface AvailabilityContext {
  environments: Environment[]
  avoid: AvoidTag[]
  /** Outdoor/none-only mode: only exercises needing nothing at all. */
  strictNoEquipment?: boolean
}

export function ctxFromProfile(p: Pick<Profile, 'environments' | 'avoid'> | null, strict = false): AvailabilityContext {
  return { environments: p?.environments ?? [], avoid: p?.avoid ?? [], strictNoEquipment: strict }
}

export function equipmentAvailable(eq: Equipment, ctx: AvailabilityContext): boolean {
  if (eq === 'none') return true
  if (ctx.strictNoEquipment) return false
  const src = EQUIPMENT_SOURCES[eq]
  return src === 'always' || src.some((e) => ctx.environments.includes(e))
}

export function isAvailable(ex: Exercise, ctx: AvailabilityContext): boolean {
  if (!equipmentAvailable(ex.equipment, ctx)) return false
  return !ex.avoidTags.some((t) => ctx.avoid.includes(t))
}

export function unavailableReason(ex: Exercise, ctx: AvailabilityContext): string | null {
  const tag = ex.avoidTags.find((t) => ctx.avoid.includes(t))
  if (tag) return `Involves ${AVOID_LABEL[tag].toLowerCase()}, which you asked to avoid`
  if (!equipmentAvailable(ex.equipment, ctx)) return `Needs ${EQUIPMENT_NEED[ex.equipment]}`
  return null
}

const EQUIPMENT_NEED: Record<Equipment, string> = {
  none: 'nothing',
  wall: 'a solid wall',
  'stable-surface': 'a stable raised surface such as a park bench or low wall',
  step: 'a step or kerb',
  hill: 'a hill',
  stairs: 'a stairway',
  bar: 'a secure, purpose-built bar',
  'low-bar': 'a secure, purpose-built low bar',
}

export const AVOID_LABEL: Record<AvoidTag, string> = {
  jumping: 'Jumping and impact',
  kneeling: 'Kneeling',
  'wrist-load': 'Weight on the wrists',
  'deep-knee-bend': 'Deep knee bending',
  overhead: 'Overhead arm positions',
  running: 'Running',
  'spinal-flexion': 'Repeated spinal flexion',
  'lying-prone': 'Lying face down',
}

/**
 * Find the closest usable exercise to `id`: the exercise itself, its listed alternative,
 * then the nearest available step in its progression track (easier first).
 */
export function resolveExercise(id: string, ctx: AvailabilityContext): Exercise | undefined {
  const ex = getExercise(id)
  if (!ex) return undefined
  if (isAvailable(ex, ctx)) return ex
  const seen = new Set<string>([id])
  let alt = ex.alternativeId
  while (alt && !seen.has(alt)) {
    seen.add(alt)
    const a = getExercise(alt)
    if (a && isAvailable(a, ctx)) return a
    alt = a?.alternativeId
  }
  const track = Object.values(TRACKS).find((t) => t.exerciseIds.includes(id))
  if (track) {
    const i = track.exerciseIds.indexOf(id)
    for (let d = 1; d < track.exerciseIds.length; d++) {
      for (const j of [i - d, i + d]) {
        const cand = track.exerciseIds[j] && getExercise(track.exerciseIds[j])
        if (cand && isAvailable(cand, ctx)) return cand
      }
    }
  }
  const subs = substitutes(ex, ctx)
  return subs[0]
}

/** Available exercises in a track, in progression order. */
export function availableTrack(trackId: TrackId, ctx: AvailabilityContext): Exercise[] {
  return TRACKS[trackId].exerciseIds.map((i) => getExercise(i)).filter((x): x is Exercise => !!x && isAvailable(x, ctx))
}

export function nextInTrack(trackId: TrackId, exerciseId: string, dir: 1 | -1, ctx: AvailabilityContext): Exercise | undefined {
  const ids = TRACKS[trackId].exerciseIds
  let i = ids.indexOf(exerciseId)
  if (i < 0) return undefined
  for (i += dir; i >= 0 && i < ids.length; i += dir) {
    const cand = getExercise(ids[i])
    if (cand && isAvailable(cand, ctx)) return cand
  }
  return undefined
}

/**
 * Comparable alternatives that keep the intended training stimulus: same movement pattern
 * (or category for mobility work), available with the user's equipment, closest in difficulty.
 */
export function substitutes(ex: Exercise, ctx: AvailabilityContext, limit = 6): Exercise[] {
  const samePattern = (c: Exercise) =>
    c.pattern === ex.pattern ||
    (ex.category === c.category && (ex.category === 'mobility' || ex.category === 'stretch' || ex.category === 'conditioning'))
  return allExercises()
    .filter((c) => c.id !== ex.id && samePattern(c) && isAvailable(c, ctx) && (c.metric === 'distance') === (ex.metric === 'distance'))
    .sort((a, b) => {
      const da = Math.abs(a.difficulty - ex.difficulty) + (a.pattern === ex.pattern ? 0 : 1.5)
      const db = Math.abs(b.difficulty - ex.difficulty) + (b.pattern === ex.pattern ? 0 : 1.5)
      return da - db
    })
    .slice(0, limit)
}
