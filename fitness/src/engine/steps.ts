import type { ExerciseLog, Workout } from '../lib/types'

export interface Step {
  blockIndex: number
  exerciseIndex: number
  setIndex: number // 0-based set or round number
  totalSets: number
  isCircuit: boolean
  /** Rest after this step before the next one. */
  restAfterSec: number
}

/**
 * Flatten a workout into the ordered sequence the player walks through.
 * Straight-set blocks: all sets of exercise 1, then exercise 2…
 * Circuit blocks (rounds > 1): one set of each exercise per round, longer rest between rounds.
 */
export function buildSteps(w: Workout): Step[] {
  const steps: Step[] = []
  w.blocks.forEach((b, bi) => {
    const circuit = (b.rounds ?? 0) > 1 || b.kind === 'warmup' || b.kind === 'cooldown'
    if (circuit) {
      const rounds = Math.max(1, b.rounds ?? 1)
      for (let r = 0; r < rounds; r++) {
        b.exercises.forEach((x, xi) => {
          if (x.skipped) return
          const lastInRound = xi === b.exercises.length - 1
          steps.push({
            blockIndex: bi, exerciseIndex: xi, setIndex: r, totalSets: rounds, isCircuit: true,
            restAfterSec: lastInRound ? (r < rounds - 1 ? 60 : 0) : x.restSec,
          })
        })
      }
    } else {
      b.exercises.forEach((x, xi) => {
        if (x.skipped) return
        for (let s = 0; s < x.targetSets; s++) {
          steps.push({ blockIndex: bi, exerciseIndex: xi, setIndex: s, totalSets: x.targetSets, isCircuit: false, restAfterSec: x.restSec })
        }
      })
    }
  })
  return steps
}

export function exerciseAt(w: Workout, s: Step): ExerciseLog {
  return w.blocks[s.blockIndex].exercises[s.exerciseIndex]
}

/** Total logged working sets (main + finisher blocks). */
export function workingSets(w: Workout): number {
  return w.blocks.filter((b) => b.kind === 'main' || b.kind === 'finisher').reduce((a, b) => a + b.exercises.reduce((n, x) => n + x.sets.length, 0), 0)
}

export function totalReps(w: Workout): number {
  return w.blocks.reduce((a, b) => a + b.exercises.reduce((n, x) => n + x.sets.reduce((m, s) => m + (s.reps ?? 0), 0), 0), 0)
}

export function elapsedMs(x: { activeMs: number; runningSince: number | null }, now = Date.now()) {
  return x.activeMs + (x.runningSince ? now - x.runningSince : 0)
}
