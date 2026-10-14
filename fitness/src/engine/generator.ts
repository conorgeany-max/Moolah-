import { MOBILITY_ROUTINES } from '../data/mobility'
import { dayKey } from '../lib/date'
import type { ExerciseLog, Profile, Programme, Run, TrackId, Workout, WorkoutBlock } from '../lib/types'
import { ctxFromProfile, getExercise, isAvailable, resolveExercise } from './library'
import { cooldownBlock, exerciseLog, fitToMinutes, initialSlots, newWorkout, rangeFor, routineBlock, warmupBlock } from './programme'
import { SESSION_INFO } from './schedule'

export type Focus = 'full' | 'upper' | 'lower' | 'core' | 'conditioning' | 'mobility'
export type Energy = 'low' | 'normal' | 'high'

export interface GeneratorInput {
  minutes: number
  focus: Focus
  energy: Energy
  noEquipment: boolean
}

export const FOCUS_LABEL: Record<Focus, string> = {
  full: 'Full body',
  upper: 'Upper body & core',
  lower: 'Legs & glutes',
  core: 'Core',
  conditioning: 'Conditioning',
  mobility: 'Mobility',
}

const FOCUS_TRACKS: Record<Exclude<Focus, 'mobility' | 'conditioning'>, TrackId[]> = {
  full: ['push', 'squat', 'upper-back', 'single-leg', 'hinge', 'plank'],
  upper: ['push', 'vertical-push', 'bar-pull', 'upper-back', 'plank', 'side-plank'],
  lower: ['jump', 'squat', 'single-leg', 'lunge', 'hinge', 'calf'],
  core: ['plank', 'hollow', 'side-plank', 'leg-raise'],
}

/** Recent hard work in the last ~36 hours, used to keep generated sessions sensible. */
export function recentHardWork(workouts: Workout[], runs: Run[], now = Date.now()): string | null {
  const cutoff = now - 36 * 3600_000
  const w = workouts.find((x) => x.status !== 'active' && x.intensity === 'hard' && Date.parse(x.completedAt ?? x.startedAt) > cutoff)
  if (w) return w.title
  const r = runs.find((x) => x.status === 'completed' && x.sessionType === 'run-quality' && Date.parse(x.completedAt ?? x.startedAt) > cutoff)
  return r ? r.title : null
}

export function generateWorkout(input: GeneratorInput, p: Profile, prog: Programme | null, workouts: Workout[], runs: Run[]): { workout: Workout; explanation: string[] } {
  const ctx = ctxFromProfile(p, input.noEquipment)
  const explanation: string[] = []
  let energy = input.energy
  const recent = recentHardWork(workouts, runs)
  if (recent && input.focus !== 'mobility' && energy === 'high') {
    energy = 'normal'
    explanation.push(`You did “${recent}” recently, so intensity is capped at moderate.`)
  }
  const slots = prog?.slots ?? initialSlots(p)
  let blocks: WorkoutBlock[]
  let intensity: Workout['intensity'] = energy === 'low' ? 'easy' : 'moderate'

  if (input.focus === 'mobility') {
    const routine = [...MOBILITY_ROUTINES].filter((r) => r.goal !== 'Warm-up').sort((a, b) => Math.abs(a.minutes - input.minutes) - Math.abs(b.minutes - input.minutes))[0]
    blocks = [routineBlock(routine, ctx, input.minutes >= routine.minutes * 1.8 ? 2 : 1)]
    intensity = 'easy'
    explanation.push(`Built from the “${routine.name}” routine.`)
  } else if (input.focus === 'conditioning') {
    const low = energy === 'low' || p.avoid.includes('jumping') || p.experience === 'new'
    const ids = low
      ? ['step-jack', 'reverse-lunge', 'bear-plank', 'step-back-burpee', 'squat-hold']
      : ['jumping-jack', 'mountain-climber', 'bear-crawl', 'burpee', 'lunge-knee-drive', 'high-knees', 'stair-climb']
    const picked = ids.map((id) => resolveExercise(id, ctx)).filter((x, i, a) => x && a.findIndex((y) => y?.id === x.id) === i).slice(0, 5)
    const rounds = Math.max(2, Math.min(5, Math.floor((input.minutes - 6) / 4)))
    blocks = [
      warmupBlock(input.minutes <= 12 ? 'short' : 'conditioning', ctx),
      { kind: 'main', title: `Circuit · ${rounds} rounds`, rounds, exercises: picked.map((ex) => exerciseLog(ex!, rounds, ex!.metric === 'time' ? (low ? 20 : 30) : 8, 20)) },
      cooldownBlock('conditioning', ctx, 2),
    ]
    if (energy === 'high') intensity = 'hard'
    explanation.push(low ? 'Low-impact choices for today.' : 'Work 30 seconds, rest 20 seconds between movements.')
  } else {
    const tracks = FOCUS_TRACKS[input.focus].filter((t) => {
      if (t === 'jump') return energy === 'high' && !p.avoid.includes('jumping') && p.experience !== 'new'
      if (t === 'bar-pull') return !!slots['bar-pull'] && !input.noEquipment
      if (t === 'upper-back' && input.focus === 'upper' && slots['bar-pull'] && !input.noEquipment) return true
      return true
    })
    const main: ExerciseLog[] = []
    for (const t of tracks) {
      const slot = slots[t]
      if (!slot) continue
      let ex = getExercise(slot.exerciseId)
      if (!ex) continue
      if (!isAvailable(ex, ctx)) ex = resolveExercise(ex.id, ctx)
      if (!ex || main.some((m) => m.exerciseId === ex!.id)) continue
      const sets = energy === 'low' ? 2 : Math.max(2, slot.sets)
      const target = ex.id === slot.exerciseId ? slot.target : rangeFor(ex)[0]
      main.push(exerciseLog(ex, sets, target, ex.defaults.restSec))
    }
    blocks = [warmupBlock(input.minutes <= 15 ? 'short' : 'strength', ctx), { kind: 'main', title: 'Main work', exercises: main }, cooldownBlock('strength', ctx, 2)]
    if (energy === 'high' && input.minutes >= 35) {
      const fin = resolveExercise('mountain-climber', ctx)
      if (fin) blocks.splice(2, 0, { kind: 'finisher', title: 'Finisher · 2 rounds', rounds: 2, exercises: [exerciseLog(fin, 2, 30, 30)] })
    }
    explanation.push('Uses your current programme levels, so the difficulty matches what you’ve logged.')
    if (energy === 'low') explanation.push('Low energy: two sets each, and stop each set with a few reps in reserve.')
    if (energy === 'high' && intensity !== 'easy') intensity = 'hard'
  }
  const fit = fitToMinutes(blocks, input.minutes, ctx)
  if (fit.notes.length) explanation.push(`To fit ${input.minutes} minutes: ${fit.notes.join(', ').toLowerCase()}.`)
  if (input.noEquipment) explanation.push('Only exercises needing nothing at all.')
  const workout = newWorkout({
    date: dayKey(),
    sessionType: 'generated',
    title: `${FOCUS_LABEL[input.focus]} · ${input.minutes} min`,
    purpose: `A generated ${FOCUS_LABEL[input.focus].toLowerCase()} session for the time and energy you have today.`,
    intensity,
    blocks: fit.blocks,
    modifiers: explanation,
  })
  return { workout, explanation }
}

export { SESSION_INFO }
