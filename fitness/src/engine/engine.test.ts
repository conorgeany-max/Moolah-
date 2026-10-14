import { benchmarkDeltas, retestDue } from './benchmarks'
import { describe, expect, it } from 'vitest'
import { EXERCISES, TRACKS } from '../data/exercises'
import type { Profile, Run, Workout } from '../lib/types'
import { DEFAULT_UNITS } from '../lib/units'
import { ctxFromProfile, isAvailable, resolveExercise, substitutes, getExercise } from './library'
import { buildSessionWorkout, createProgramme, estimateMinutes, fitToMinutes } from './programme'
import { evaluateSlot } from './progression'
import { recordHits } from './records'
import { afterRunWalk, applyPain, buildRunPlan, gpsIncrement, reviewRunWeek } from './running'
import { evaluateWeek, moveSession, planFor, SESSION_INFO } from './schedule'
import { buildSteps } from './steps'
import { generateWorkout } from './generator'

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'me', createdAt: '', updatedAt: '', units: DEFAULT_UNITS, experience: 'new', runLevel: 'none',
  goals: ['fitness'], trainingDays: [0, 2, 4, 5], sessionMinutes: 40, environments: ['backyard'],
  capabilities: {}, avoid: [], injuryNotes: '', coaching: 'calm', intensity: 'moderate', ...over,
})

describe('exercise library', () => {
  it('has unique ids and valid links', () => {
    const ids = new Set(EXERCISES.map((e) => e.id))
    expect(ids.size).toBe(EXERCISES.length)
    for (const e of EXERCISES) {
      for (const link of [e.easierId, e.harderId, e.alternativeId]) if (link) expect(ids.has(link), `${e.id} → ${link}`).toBe(true)
      expect(e.steps.length).toBeGreaterThan(0)
    }
    for (const t of Object.values(TRACKS)) for (const id of t.exerciseIds) expect(ids.has(id), id).toBe(true)
  })
  it('never needs equipment the user lacks', () => {
    const ctx = ctxFromProfile(profile({ environments: [] }))
    const rfess = resolveExercise('rfess', ctx)!
    expect(rfess.equipment).toBe('none')
    expect(resolveExercise('pullup', ctx)!.equipment).toBe('none')
    expect(resolveExercise('hill-sprint', ctx)!.id).toBe('strides')
  })
  it('respects avoided movements in substitutions', () => {
    const ctx = ctxFromProfile(profile({ avoid: ['jumping'] }))
    const subs = substitutes(getExercise('squat-jump')!, ctx)
    expect(subs.every((s) => !s.avoidTags.includes('jumping'))).toBe(true)
  })
})

describe('programme', () => {
  it('builds a balanced beginner week without back-to-back hard days', () => {
    const p = profile()
    const prog = createProgramme(p, '2026-10-13')
    expect(prog.weeks).toBe(8)
    expect(prog.startDate).toBe('2026-10-12')
    const week = Array.from({ length: 7 }, (_, i) => prog.template[i as 0])
    expect(evaluateWeek(week).issues.filter((i) => i.severity === 'block')).toHaveLength(0)
    expect(prog.slots.push.exerciseId).toBe('incline-pushup')
    expect(prog.run.runWalkStage).toBe(0)
    expect(prog.deloadWeeks).toEqual([4])
  })
  it('caps at six training days', () => {
    const prog = createProgramme(profile({ trainingDays: [0, 1, 2, 3, 4, 5, 6] }), '2026-10-13')
    expect(Object.keys(prog.template).length).toBe(6)
  })
  it('starts from stated capabilities, not assumptions', () => {
    const prog = createProgramme(profile({ experience: 'regular', capabilities: { pushups: 12 } }), '2026-10-13')
    expect(prog.slots.push.exerciseId).toBe('pushup')
    expect(prog.slots.push.target).toBe(7)
  })
  it('builds a workout that fits the time limit', () => {
    const p = profile({ experience: 'regular' })
    const prog = createProgramme(p, '2026-10-13')
    const w = buildSessionWorkout('strength-a', '2026-10-13', prog, p, { minutes: 20 })
    expect(estimateMinutes(w.blocks)).toBeLessThanOrEqual(22)
    expect(buildSteps(w).length).toBeGreaterThan(5)
    const fit = fitToMinutes(w.blocks, 10, ctxFromProfile(p))
    expect(fit.blocks.find((b) => b.kind === 'warmup')).toBeTruthy()
  })
  it('deload reduces sets', () => {
    const p = profile({ experience: 'regular' })
    const prog = createProgramme(p, '2026-10-13')
    const normal = buildSessionWorkout('strength-a', '2026-10-13', prog, p)
    const deload = buildSessionWorkout('strength-a', '2026-10-13', prog, p, { deload: true })
    const sets = (w: Workout) => w.blocks.find((b) => b.kind === 'main')!.exercises.reduce((a, x) => a + x.targetSets, 0)
    expect(sets(deload)).toBeLessThan(sets(normal))
  })
  it('blocks moving a hard session next to another hard session unless lightened', () => {
    const p = profile({ experience: 'regular', trainingDays: [0, 2, 4] })
    const prog = createProgramme(p, '2026-10-12')
    const hardDay = Object.entries(prog.template).find(([, t]) => t && SESSION_INFO[t].hard)!
    const from = `2026-10-${String(12 + Number(hardDay[0])).padStart(2, '0')}`
    const others = Object.entries(prog.template).filter(([d, t]) => d !== hardDay[0] && t && SESSION_INFO[t].hard)
    if (!others.length) return
    const neighbour = Number(others[0][0]) + 1
    if (neighbour > 6) return
    const to = `2026-10-${String(12 + neighbour).padStart(2, '0')}`
    const r = moveSession(prog, from, to)
    if (!r.ok) {
      const lightened = moveSession(prog, from, to, true)
      expect(lightened.ok).toBe(true)
    }
    expect(planFor({ ...prog, overrides: r.overrides }, to).type).toBe(hardDay[1])
  })
})

describe('progression', () => {
  const slot = { slotId: 'push', trackId: 'push' as const, exerciseId: 'pushup', sets: 3, target: 8, range: [5, 15] as [number, number], metric: 'reps' as const }
  const log = (reps: number[], effort?: 'easy' | 'solid' | 'max') => ({ id: 'x', exerciseId: 'pushup', slotId: 'push', targetSets: 3, targetReps: 8, restSec: 90, sets: reps.map((r) => ({ id: 's', reps: r, completedAt: '' })), effort })
  it('does not progress on a single unrated session', () => {
    expect(evaluateSlot(slot, [log([8, 8, 8])], profile()).recommendation).toBeUndefined()
  })
  it('progresses after two solid sessions', () => {
    const r = evaluateSlot(slot, [log([8, 8, 9], 'solid'), log([8, 8, 8], 'solid')], profile())
    expect(r.slot.target).toBe(9)
    expect(r.recommendation?.status).toBe('auto')
  })
  it('recommends a harder variation at the top of the range', () => {
    const top = { ...slot, target: 15 }
    const l = { ...log([15, 15, 15], 'easy'), targetReps: 15 }
    const r = evaluateSlot(top, [l], profile())
    expect(r.recommendation?.kind).toBe('harder-variation')
    expect(r.recommendation?.toExerciseId).toBe('tempo-pushup')
  })
  it('never progresses on a max effort or broken technique', () => {
    expect(evaluateSlot(slot, [log([8, 8, 8], 'max')], profile()).recommendation).toBeUndefined()
  })
  it('eases target after two short sessions', () => {
    const r = evaluateSlot(slot, [log([5, 4, 4]), log([5, 5, 4])], profile())
    expect(r.slot.target).toBe(6)
  })
})

describe('running', () => {
  it('advances run/walk only after two manageable sessions', () => {
    const prog = createProgramme(profile(), '2026-10-13')
    const run = { feel: 'moderate', completedPlan: true } as Run
    const a = afterRunWalk(prog.run, run)
    expect(a.run.runWalkStage).toBe(0)
    const b = afterRunWalk(a.run, run)
    expect(b.run.runWalkStage).toBe(1)
  })
  it('never raises volume and intensity in the same week', () => {
    const p = profile({ runLevel: 'fivek', experience: 'regular' })
    const prog = createProgramme(p, '2026-10-13')
    const runs = [
      { status: 'completed', sessionType: 'run-easy', feel: 'easy' },
      { status: 'completed', sessionType: 'run-quality', feel: 'moderate' },
    ] as Run[]
    const w1 = reviewRunWeek(prog, runs, 2, 1, false)
    expect(w1.run.lastProgressed).toBe('volume')
    expect(w1.run.qualityStage).toBe(prog.run.qualityStage)
    const w2 = reviewRunWeek({ ...prog, run: w1.run }, runs, 2, 2, false)
    expect(w2.run.lastProgressed).toBe('intensity')
    expect(w2.run.longMinutes).toBe(w1.run.longMinutes)
  })
  it('steps running back on pain and holds the week on a niggle', () => {
    const prog = createProgramme(profile(), '2026-10-13')
    const advanced = { ...prog.run, runWalkStage: 3 }
    expect(applyPain(advanced, { pain: 'pain' } as Run)?.run.runWalkStage).toBe(2)
    expect(applyPain(advanced, { pain: 'niggle' } as Run)?.run.runWalkStage).toBe(3)
    expect(applyPain(advanced, { pain: 'none' } as Run)).toBeNull()
    const p = profile({ runLevel: 'fivek', experience: 'regular' })
    const cont = createProgramme(p, '2026-10-13')
    const hurt = applyPain(cont.run, { pain: 'pain' } as Run)!
    expect(hurt.run.longMinutes).toBeLessThan(cont.run.longMinutes)
    const runs = [
      { status: 'completed', sessionType: 'run-easy', feel: 'easy', pain: 'niggle' },
      { status: 'completed', sessionType: 'run-long', feel: 'easy' },
    ] as Run[]
    const w = reviewRunWeek(cont, runs, 2, 1, false)
    expect(w.run.longMinutes).toBe(cont.run.longMinutes)
    expect(w.run.qualityStage).toBe(cont.run.qualityStage)
  })
  it('builds run/walk plans for beginners even on quality days', () => {
    const p = profile()
    const prog = createProgramme(p, '2026-10-13')
    const plan = buildRunPlan('run-quality', p, prog)
    expect(plan.segments.some((s) => s.kind === 'walk')).toBe(true)
  })
  it('ignores GPS jitter and inaccurate fixes', () => {
    const a = { lat: 51.5, lon: -0.1, t: 0, acc: 10 }
    expect(gpsIncrement(a, { lat: 51.50001, lon: -0.1, t: 1000, acc: 10 })).toBe(0)
    expect(gpsIncrement(a, { lat: 51.5005, lon: -0.1, t: 20000, acc: 80 })).toBe(0)
    expect(gpsIncrement(a, { lat: 51.5005, lon: -0.1, t: 20000, acc: 8 })).toBeGreaterThan(50)
  })
})

describe('records', () => {
  it('distinguishes a PR from more volume', () => {
    const base = (id: string, reps: number[]): Workout => ({
      id, date: '2026-10-13', sessionType: 'strength-a', title: '', purpose: '', intensity: 'hard', estimatedMinutes: 30, status: 'completed',
      startedAt: id, activeMs: 0, runningSince: null, modifiers: [], cursor: 0, rest: null,
      blocks: [{ kind: 'main', title: '', exercises: [{ id: 'x', exerciseId: 'pushup', targetSets: 3, restSec: 60, sets: reps.map((r) => ({ id: 's', reps: r, completedAt: '' })) }] }],
    })
    const prev = base('a', [10, 8, 8])
    expect(recordHits(base('b', [9, 9, 9, 9]), [prev])).toHaveLength(0)
    expect(recordHits(base('c', [11, 8]), [prev])[0].kind).toBe('reps')
  })
})

describe('generator', () => {
  it('only uses no-equipment exercises in strict mode', () => {
    const p = profile({ environments: ['park', 'stairs', 'bar'] })
    const { workout } = generateWorkout({ minutes: 30, focus: 'full', energy: 'normal', noEquipment: true }, p, null, [], [])
    for (const b of workout.blocks) for (const x of b.exercises) expect(isAvailable(getExercise(x.exerciseId)!, { environments: [], avoid: [], strictNoEquipment: true }), x.exerciseId).toBe(true)
  })
})

describe('re-tests', () => {
  it('asks for a baseline first, then waits about four weeks', () => {
    const prog = createProgramme(profile(), '2026-10-12')
    expect(retestDue(prog, [], '2026-10-13')).toBe('baseline')
    const b = [{ id: 'b1', date: '2026-10-13', createdAt: '2026-10-13T10:00:00Z', pushups: 10, pushupExerciseId: 'pushup' }]
    expect(retestDue(prog, b, '2026-10-20')).toBeNull()
    expect(retestDue(prog, b, '2026-11-20')).toBe('retest')
  })
  it('compares push-ups only within the same variation and treats a faster km as better', () => {
    const d = benchmarkDeltas([
      { id: 'a', date: '2026-10-01', createdAt: 'a', pushups: 12, pushupExerciseId: 'knee-pushup', kmSec: 330 },
      { id: 'b', date: '2026-11-01', createdAt: 'b', pushups: 6, pushupExerciseId: 'pushup', kmSec: 310 },
    ])
    expect(d.find((x) => x.key === 'pushups')?.change).toBeUndefined()
    expect(d.find((x) => x.key === 'kmSec')?.change).toBe(20)
  })
})
