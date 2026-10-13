import { buildSessionWorkout } from '../engine/programme'
import { isRunSession, planFor, type DayPlan } from '../engine/schedule'
import { daysSinceLastTraining } from '../engine/stats'
import { startWorkout } from './actions'
import { dayKey } from './date'
import { navigate } from './router'
import { getState } from './store'
import type { SessionType, Workout } from './types'

export interface StartOptions {
  minutes?: number
  lighten?: boolean
  strictNoEquipment?: boolean
  type?: SessionType
}

/** Build (without saving) the workout for a planned day, applying deload, lightening and return-from-break rules. */
export function previewWorkout(plan: DayPlan, opts: StartOptions = {}): Workout | null {
  const { profile, programme, workouts, runs, settings } = getState()
  if (!profile || !programme) return null
  const type = opts.type ?? plan.type
  if (isRunSession(type)) return null
  return buildSessionWorkout(type === 'rest' ? 'mobility' : type, plan.date, programme, profile, {
    deload: plan.isDeload,
    lighten: opts.lighten ?? plan.lighten,
    minutes: opts.minutes,
    strictNoEquipment: opts.strictNoEquipment ?? settings.outdoorMode,
    daysSinceLastSession: daysSinceLastTraining(workouts, runs, plan.date),
  })
}

export function startPlanned(date: string = dayKey(), opts: StartOptions = {}) {
  const { programme } = getState()
  if (!programme) return
  const plan = planFor(programme, date)
  const type = opts.type ?? plan.type
  if (isRunSession(type)) {
    const q = new URLSearchParams({ type, date })
    if (opts.minutes) q.set('minutes', String(opts.minutes))
    if (opts.lighten ?? plan.lighten) q.set('lighten', '1')
    navigate(`/run?${q}`)
    return
  }
  const w = previewWorkout(plan, opts)
  if (!w) return
  startWorkout({ ...w, outdoorMode: opts.strictNoEquipment ?? getState().settings.outdoorMode })
  navigate('/workout')
}

export function startCustom(w: Workout) {
  startWorkout(w)
  navigate('/workout')
}
