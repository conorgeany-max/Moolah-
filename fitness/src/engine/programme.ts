import { TRACKS } from '../data/exercises'
import { ROUTINE_MAP, type MobilityRoutine } from '../data/mobility'
import { dayKey, mondayOf, weekdayOf } from '../lib/date'
import { clamp } from '../lib/format'
import { uid } from '../lib/id'
import type {
  DayKey,
  Exercise,
  ExerciseLog,
  Profile,
  Programme,
  RunState,
  SessionType,
  SlotState,
  TrackId,
  Weekday,
  Workout,
  WorkoutBlock,
} from '../lib/types'
import { availableTrack, ctxFromProfile, isAvailable, getExercise, resolveExercise, type AvailabilityContext } from './library'
import { RUN_WALK_STAGES } from '../data/running'
import { arrangeWeek, evaluateWeek, SESSION_INFO, weeklySessions } from './schedule'

// ───────────── Starting levels ─────────────

function levelIndex(p: Profile, trackId: TrackId): number {
  const exp = { new: 0, some: 1, regular: 2, advanced: 3 }[p.experience]
  const c = p.capabilities
  switch (trackId) {
    case 'push': {
      if (c.pushups !== undefined) {
        if (c.pushups === 0) return (c.kneePushups ?? 0) >= 8 ? 2 : 1
        if (c.pushups < 5) return 2
        if (c.pushups < 15) return 3
        if (c.pushups < 25) return 4
        if (c.pushups < 35) return 5
        return 6
      }
      return [1, 2, 3, 4][exp]
    }
    case 'vertical-push':
      return [0, 0, 1, 1][exp]
    case 'squat': {
      if (c.squats !== undefined) {
        if (c.squats < 8) return 0
        if (c.squats < 30) return 1
        if (c.squats < 50) return 2
        return 3
      }
      return [1, 1, 2, 3][exp]
    }
    case 'single-leg':
      return [0, 0, 1, 2][exp]
    case 'lunge':
      return [0, 0, 1, 2][exp]
    case 'hinge':
      return [0, 1, 2, 3][exp]
    case 'calf':
      return [0, 0, 1, 1][exp]
    case 'plank': {
      if (c.plankSec !== undefined) return c.plankSec < 20 ? 0 : c.plankSec < 60 ? 1 : 2
      return [0, 1, 1, 2][exp]
    }
    case 'hollow':
      return [0, 1, 1, 2][exp]
    case 'side-plank':
      return [0, 1, 1, 1][exp]
    case 'leg-raise':
      return [0, 0, 1, 1][exp]
    case 'upper-back':
      return [0, 1, 2, 2][exp]
    case 'bar-pull':
      return [0, 1, 2, 3][exp]
    case 'jump':
      return [0, 0, 1, 1][exp]
    case 'conditioning':
      return [0, 0, 0, 1][exp]
  }
}

function targetFromCapability(p: Profile, trackId: TrackId, ex: Exercise, range: [number, number]): number {
  const c = p.capabilities
  const fraction = p.intensity === 'gentle' ? 0.5 : p.intensity === 'ambitious' ? 0.7 : 0.6
  let max: number | undefined
  if (trackId === 'push' && ex.id === 'pushup' && c.pushups) max = c.pushups
  if (trackId === 'push' && ex.id === 'knee-pushup' && c.kneePushups) max = c.kneePushups
  if (trackId === 'squat' && ex.id === 'bodyweight-squat' && c.squats) max = c.squats
  if (trackId === 'plank' && ex.id === 'plank' && c.plankSec) max = c.plankSec
  if (max === undefined) return range[0]
  return clamp(Math.round(max * fraction), range[0], range[1])
}

export function rangeFor(ex: Exercise): [number, number] {
  if (ex.metric === 'time') return ex.defaults.seconds ?? [20, 40]
  if (ex.metric === 'distance') return [ex.defaults.meters ?? 20, ex.defaults.meters ?? 20]
  return ex.defaults.reps ?? [8, 12]
}

export function slotFor(trackId: TrackId, ex: Exercise, sets: number, target?: number): SlotState {
  const range = rangeFor(ex)
  return { slotId: trackId, trackId, exerciseId: ex.id, sets, target: target ?? range[0], range, metric: ex.metric }
}

export function initialSlots(p: Profile): Record<string, SlotState> {
  const ctx = ctxFromProfile(p)
  const baseSets = p.experience === 'new' || p.intensity === 'gentle' ? 2 : 3
  const slots: Record<string, SlotState> = {}
  for (const trackId of Object.keys(TRACKS) as TrackId[]) {
    if (trackId === 'bar-pull' && !p.environments.includes('bar')) continue
    const ids = TRACKS[trackId].exerciseIds
    const idx = clamp(levelIndex(p, trackId), 0, ids.length - 1)
    const ex = resolveExercise(ids[idx], ctx)
    if (!ex) continue
    const range = rangeFor(ex)
    const sets = ex.category === 'core' || ex.category === 'jump' ? Math.min(baseSets, 3) : baseSets
    slots[trackId] = slotFor(trackId, ex, sets, targetFromCapability(p, trackId, ex, range))
  }
  return slots
}

export function initialRunState(p: Profile): RunState {
  const base: RunState = {
    runWalkStage: -1, easyMinutes: 20, longMinutes: 25, qualityStage: 0,
    lastProgressed: 'none', lastProgressedWeek: 0, reviewedWeek: 0, stageSuccesses: 0, stageStruggles: 0,
  }
  const longest = p.capabilities.runMinutes
  switch (p.runLevel) {
    case 'none':
      return { ...base, runWalkStage: 0 }
    case 'runwalk': {
      const stage = longest ? RUN_WALK_STAGES.findIndex(([run]) => run / 60 > longest) : 2
      return { ...base, runWalkStage: clamp(stage < 0 ? RUN_WALK_STAGES.length - 1 : Math.max(0, stage - 1), 0, RUN_WALK_STAGES.length - 1) }
    }
    case 'continuous20':
      return { ...base, easyMinutes: 20, longMinutes: 25 }
    case 'fivek':
      return { ...base, easyMinutes: clamp(Math.round((longest ?? 35) * 0.7), 20, 35), longMinutes: clamp(longest ?? 35, 25, 50), qualityStage: 1 }
    case 'tenk':
      return { ...base, easyMinutes: clamp(Math.round((longest ?? 55) * 0.6), 25, 45), longMinutes: clamp(longest ?? 55, 35, 75), qualityStage: 2 }
  }
}

export function programmeLength(p: Profile): number {
  return p.experience === 'new' ? 8 : p.experience === 'advanced' ? 12 : 10
}

export function createProgramme(p: Profile, today: DayKey = dayKey(), carryOver?: Programme): Programme {
  const weeks = programmeLength(p)
  const avoidRunning = p.avoid.includes('running')
  let sessions = weeklySessions(p.trainingDays.length || 3, p.goals, p.runLevel, avoidRunning)
  const days: Weekday[] = p.trainingDays.length ? p.trainingDays : [0, 2, 4]
  let template = arrangeWeek(days, sessions)
  const blocked = (t: typeof template) => evaluateWeek(Array.from({ length: 7 }, (_, i) => t[i as Weekday])).issues.some((i) => i.severity === 'block')
  const downgraded: string[] = []
  // If the chosen days force hard sessions back to back, swap the least essential hard session for an easier one.
  for (const [from, to, why] of [
    ['run-quality', 'run-long', 'the quality run becomes a long easy run'],
    ['strength-c', 'conditioning', 'the third strength day becomes a moderate conditioning session'],
  ] as [SessionType, SessionType, string][]) {
    if (!blocked(template) || !sessions.includes(from)) continue
    const candidate = sessions.map((s) => (s === from ? (sessions.includes(to) && to === 'run-long' ? 'run-easy' : to) : s))
    sessions = candidate
    template = arrangeWeek(days, sessions)
    downgraded.push(why)
  }
  const deloadWeeks = Array.from({ length: weeks }, (_, i) => i + 1).filter((w) => w % 4 === 0 && w < weeks)

  const rationale: string[] = []
  const counts = sessions.reduce<Record<string, number>>((acc, s) => ((acc[SESSION_INFO[s].kind] = (acc[SESSION_INFO[s].kind] ?? 0) + 1), acc), {})
  rationale.push(
    `${days.length} training day${days.length === 1 ? '' : 's'} a week: ${counts.strength ?? 0} strength, ${counts.run ?? 0} running${counts.conditioning ? `, ${counts.conditioning} conditioning` : ''}${counts.mobility ? `, ${counts.mobility} mobility` : ''}.`,
  )
  if (downgraded.length) rationale.push(`Your training days are close together, so ${downgraded.join(' and ')} to avoid hard days back to back.`)
  if (p.trainingDays.length > 6) rationale.push('One day is kept as a full rest day: recovery is when adaptation happens.')
  rationale.push('Sessions are arranged so hard days are not back to back where your availability allows.')
  rationale.push(`Deload (reduced-volume) weeks: ${deloadWeeks.length ? deloadWeeks.map((w) => `week ${w}`).join(', ') : 'none in a programme this short'}. You can also take one early if fatigue builds.`)
  rationale.push('Exercises progress only when your logged sets show you are ready, never just because a week has passed.')
  if (avoidRunning) rationale.push('Running is excluded because you asked to avoid it; conditioning replaces it.')
  if (p.runLevel === 'none' || p.runLevel === 'runwalk') rationale.push('Running starts with run/walk intervals so your joints and tendons adapt alongside your fitness.')
  if (!p.environments.includes('bar'))
    rationale.push('Without a secure bar, pulling is trained with prone raises and pulldowns. These help, but cannot fully replace pulling against resistance.')

  if (weekdayOf(today) !== 0 && !carryOver) rationale.push('Week 1 starts today, so sessions earlier this week are left out rather than counted as missed.')

  const slots = initialSlots(p)
  if (carryOver) {
    for (const [k, v] of Object.entries(carryOver.slots)) if (slots[k]) slots[k] = v
  }
  return {
    id: uid('prog'),
    createdAt: new Date().toISOString(),
    startDate: mondayOf(today),
    firstDay: today,
    weeks,
    template,
    deloadWeeks,
    extraDeloadWeeks: [],
    overrides: {},
    slots,
    run: carryOver ? { ...carryOver.run, reviewedWeek: 0, lastProgressedWeek: 0 } : initialRunState(p),
    rationale,
  }
}

// ───────────── Session composition ─────────────

export const SESSION_TRACKS: Record<'strength-a' | 'strength-b' | 'strength-c', TrackId[]> = {
  'strength-a': ['push', 'squat', 'hinge', 'upper-back', 'plank', 'calf'],
  'strength-b': ['vertical-push', 'single-leg', 'bar-pull', 'hollow', 'side-plank', 'hinge'],
  'strength-c': ['jump', 'push', 'lunge', 'upper-back', 'leg-raise', 'calf'],
}

export const SESSION_PURPOSE: Record<SessionType, string> = {
  'strength-a': 'Full-body strength built around push-ups, squats and glute work. Leave one or two good reps in reserve on each set.',
  'strength-b': 'Full-body strength with single-leg work, overhead pressing and trunk control.',
  'strength-c': 'Power and leg strength with low-volume jumps first while you are fresh, then pressing and lunges.',
  'run-easy': 'Easy aerobic running builds your engine and recovers you between harder days. It should feel comfortable.',
  'run-quality': 'A structured session at a harder effort to raise your aerobic ceiling. Warm up properly.',
  'run-long': 'Your longest run of the week at an easy, conversational effort: time on feet builds endurance.',
  conditioning: 'Equipment-free conditioning circuit to build work capacity at a moderate effort.',
  mobility: 'Low-intensity mobility to restore range and help you recover. This should feel good.',
  rest: 'Rest is part of training. Adaptation happens while you recover.',
}

function trackListFor(type: 'strength-a' | 'strength-b' | 'strength-c', prog: Programme, p: Profile, opts: BuildOptions): TrackId[] {
  const list = [...SESSION_TRACKS[type]]
  const pushSlot = prog.slots.push
  const pushIdx = pushSlot ? TRACKS.push.exerciseIds.indexOf(pushSlot.exerciseId) : 0
  return list
    .map((t): TrackId | null => {
      if (t === 'vertical-push' && (pushIdx < 3 || !prog.slots['vertical-push'])) return 'push'
      if (t === 'bar-pull' && (!prog.slots['bar-pull'] || opts.strictNoEquipment)) return 'upper-back'
      if (t === 'jump' && (opts.lighten || opts.deload || p.experience === 'new' || !prog.slots.jump)) return null
      return t
    })
    .filter((t): t is TrackId => !!t && !!prog.slots[t])
    .filter((t, i, arr) => arr.indexOf(t) === i)
}

export interface BuildOptions {
  lighten?: boolean
  deload?: boolean
  minutes?: number
  strictNoEquipment?: boolean
  daysSinceLastSession?: number
  /** Exercise swaps for this session only: original id → replacement id. */
  swaps?: Record<string, string>
}

function restFor(ex: Exercise, p: Profile): number {
  const conditioningBias = (p.goals.includes('fatloss') || p.goals.includes('endurance')) && !p.goals.includes('strength')
  const r = ex.defaults.restSec * (conditioningBias ? 0.8 : 1)
  return Math.max(15, Math.round(r / 15) * 15)
}

export function exerciseLog(ex: Exercise, sets: number, target: number, rest: number, slotId?: string): ExerciseLog {
  return {
    id: uid('xl'),
    exerciseId: ex.id,
    slotId,
    targetSets: sets,
    targetReps: ex.metric === 'reps' ? target : undefined,
    targetSeconds: ex.metric === 'time' ? target : undefined,
    restSec: rest,
    perSide: ex.perSide,
    sets: [],
  }
}

function pickAvailable(ids: string[], ctx: AvailabilityContext, n: number): Exercise[] {
  const out: Exercise[] = []
  for (const id of ids) {
    const ex = resolveExercise(id, ctx)
    if (ex && !out.some((o) => o.id === ex.id)) out.push(ex)
    if (out.length >= n) break
  }
  return out
}

export function warmupBlock(kind: 'strength' | 'conditioning' | 'short', ctx: AvailabilityContext): WorkoutBlock {
  const ids =
    kind === 'short'
      ? ['arm-circles', 'leg-swings', 'inchworm']
      : kind === 'conditioning'
        ? ['arm-circles', 'leg-swings', 'hip-circles', 'inchworm', 'step-jack']
        : ['arm-circles', 'leg-swings', 'inchworm', 'worlds-greatest-stretch', 'scapular-pushup', 'bodyweight-squat']
  const items = pickAvailable(ids, ctx, ids.length)
  return {
    kind: 'warmup',
    title: 'Warm-up',
    rounds: 1,
    exercises: items.map((ex) => {
      const t = ex.metric === 'time' ? 20 : ex.metric === 'distance' ? (ex.defaults.meters ?? 20) : ex.id === 'bodyweight-squat' ? 8 : Math.min(rangeFor(ex)[0], 8)
      return exerciseLog(ex, 1, t, 10)
    }),
  }
}

export function cooldownBlock(kind: 'strength' | 'run' | 'conditioning', ctx: AvailabilityContext, count = 3): WorkoutBlock {
  const ids =
    kind === 'run'
      ? ['calf-stretch', 'standing-quad', 'standing-hamstring', 'standing-hip-flexor']
      : ['chest-opener', 'standing-hip-flexor', 'figure-four', 'childs-pose', 'standing-hamstring']
  const items = pickAvailable(ids, ctx, count)
  return { kind: 'cooldown', title: 'Cool-down', rounds: 1, exercises: items.map((ex) => exerciseLog(ex, 1, 30, 5)) }
}

export function routineBlock(r: MobilityRoutine, ctx: AvailabilityContext, rounds = 1): WorkoutBlock {
  const exercises: ExerciseLog[] = []
  for (const item of r.items) {
    const ex = resolveExercise(item.exerciseId, ctx)
    if (!ex) continue
    const target = ex.metric === 'time' ? (item.seconds ?? rangeFor(ex)[0]) : ex.metric === 'distance' ? (ex.defaults.meters ?? 20) : (item.reps ?? rangeFor(ex)[0])
    exercises.push(exerciseLog(ex, rounds, target, 10))
  }
  return { kind: 'main', title: r.name, rounds, exercises }
}

function conditioningCircuit(p: Profile, ctx: AvailabilityContext, opts: BuildOptions): WorkoutBlock {
  const lowImpact = p.experience === 'new' || p.avoid.includes('jumping') || opts.lighten || opts.deload
  const ids = lowImpact
    ? ['step-jack', 'reverse-lunge', 'bear-plank', 'step-back-burpee', 'mountain-climber', 'squat-hold']
    : ['jumping-jack', 'lunge-knee-drive', 'bear-crawl', 'burpee', 'mountain-climber', 'stair-climb', 'skater-bound']
  const n = p.experience === 'advanced' ? 6 : 5
  const items = pickAvailable(ids, ctx, n)
  const rounds = opts.deload || opts.lighten ? 2 : p.experience === 'new' ? 2 : p.experience === 'advanced' ? 4 : 3
  const work = p.experience === 'new' ? 20 : 30
  return {
    kind: 'main',
    title: `Circuit · ${rounds} rounds`,
    rounds,
    exercises: items.map((ex) => {
      const target = ex.metric === 'time' ? work : Math.max(rangeFor(ex)[0], 6)
      return exerciseLog(ex, rounds, target, 20)
    }),
  }
}

function finisherBlock(p: Profile, ctx: AvailabilityContext): WorkoutBlock | null {
  if (!(p.goals.includes('fatloss') || p.goals.includes('fitness'))) return null
  const lowImpact = p.avoid.includes('jumping') || p.experience === 'new'
  const ids = lowImpact ? ['step-jack', 'bear-plank', 'step-back-burpee'] : ['mountain-climber', 'burpee', 'bear-crawl']
  const items = pickAvailable(ids, ctx, 2)
  if (!items.length) return null
  return {
    kind: 'finisher',
    title: 'Finisher · 2 rounds',
    rounds: 2,
    exercises: items.map((ex) => exerciseLog(ex, 2, ex.metric === 'time' ? 30 : 8, 30)),
  }
}

// ───────────── Duration ─────────────

export function exerciseSeconds(x: ExerciseLog): number {
  const ex = getExercise(x.exerciseId)
  const sides = x.perSide ? 2 : 1
  let work = 30
  if (ex?.metric === 'reps') work = (x.targetReps ?? 10) * 3 * sides
  else if (ex?.metric === 'time') work = (x.targetSeconds ?? 30) * sides
  else if (ex?.metric === 'distance') work = 25
  return x.targetSets * (work + x.restSec) + 15
}

export function estimateMinutes(blocks: WorkoutBlock[]): number {
  const s = blocks.reduce((acc, b) => acc + b.exercises.reduce((a, x) => a + exerciseSeconds(x), 0), 0)
  return Math.max(5, Math.round(s / 60))
}

/**
 * Trim a session to fit the available time while keeping its priorities: warm-up stays
 * (shortened), the main lifts are kept in priority order, sets and rest are reduced before
 * whole exercises are dropped, and finishers and cool-down go first.
 */
export function fitToMinutes(blocks: WorkoutBlock[], minutes: number, ctx: AvailabilityContext): { blocks: WorkoutBlock[]; notes: string[] } {
  const notes: string[] = []
  let out = blocks.map((b) => ({ ...b, exercises: b.exercises.map((x) => ({ ...x })) }))
  const over = () => estimateMinutes(out) > minutes
  if (!over()) return { blocks: out, notes }

  if (out.some((b) => b.kind === 'finisher')) {
    out = out.filter((b) => b.kind !== 'finisher')
    notes.push('Finisher removed to fit your time')
  }
  if (over() && out.some((b) => b.kind === 'warmup' && b.exercises.length > 3)) {
    out = out.map((b) => (b.kind === 'warmup' ? warmupBlock('short', ctx) : b))
    notes.push('Shorter warm-up')
  }
  if (over()) {
    out = out.map((b) => (b.kind === 'cooldown' ? { ...b, exercises: b.exercises.slice(0, 1) } : b))
  }
  if (over()) {
    for (const b of out) if (b.kind === 'main') for (const x of b.exercises) x.restSec = Math.max(30, Math.round((x.restSec * 0.7) / 15) * 15)
    notes.push('Rest periods shortened')
  }
  if (over()) {
    for (const b of out) if (b.kind === 'main') for (const x of b.exercises) x.targetSets = Math.min(x.targetSets, 2)
    for (const b of out) if (b.kind === 'main' && b.rounds && b.rounds > 2) b.rounds = 2
    notes.push('Two sets per exercise')
  }
  let dropped = 0
  while (over()) {
    const main = out.find((b) => b.kind === 'main' && b.exercises.length > 2)
    if (!main) break
    main.exercises.pop()
    dropped++
  }
  if (dropped) notes.push(`${dropped} lower-priority exercise${dropped > 1 ? 's' : ''} dropped`)
  if (over()) out = out.filter((b) => b.kind !== 'cooldown')
  return { blocks: out, notes }
}

// ───────────── Workout builder ─────────────

export function buildStrengthBlocks(type: 'strength-a' | 'strength-b' | 'strength-c', prog: Programme, p: Profile, opts: BuildOptions) {
  const ctx = ctxFromProfile(p, opts.strictNoEquipment)
  const modifiers: string[] = []
  const exercises: ExerciseLog[] = []
  for (const trackId of trackListFor(type, prog, p, opts)) {
    const slot = prog.slots[trackId]
    let ex = getExercise(slot.exerciseId)
    if (!ex) continue
    const swapTo = opts.swaps?.[ex.id]
    if (swapTo && getExercise(swapTo)) ex = getExercise(swapTo)!
    if (!isAvailable(ex, ctx)) {
      const alt = resolveExercise(ex.id, ctx)
      if (!alt) continue
      ex = alt
    }
    let sets = slot.sets
    let target = ex.id === slot.exerciseId ? slot.target : rangeFor(ex)[0]
    if (opts.deload) {
      sets = Math.max(1, sets - 1)
      target = Math.max(rangeFor(ex)[0] > 0 ? Math.round(target * 0.8) : target, 1)
    }
    if (opts.lighten) sets = Math.max(1, sets - 1)
    if ((opts.daysSinceLastSession ?? 0) >= 10) {
      sets = Math.max(1, sets - 1)
      target = Math.max(1, Math.round(target * 0.8))
    }
    exercises.push(exerciseLog(ex, sets, target, restFor(ex, p), slot.slotId))
  }
  if (opts.deload) modifiers.push('Deload week: one set fewer and slightly lower targets so you recover and come back stronger')
  if (opts.lighten) modifiers.push('Lighter session: one set fewer, jumps removed. Keep two or more reps in reserve')
  if ((opts.daysSinceLastSession ?? 0) >= 10)
    modifiers.push(`Welcome back: it has been ${opts.daysSinceLastSession} days, so volume is reduced for this session`)

  const blocks: WorkoutBlock[] = [warmupBlock('strength', ctx), { kind: 'main', title: 'Main work', exercises }]
  if (!opts.deload && !opts.lighten) {
    const fin = finisherBlock(p, ctx)
    if (fin && p.sessionMinutes >= 40) blocks.push(fin)
  }
  blocks.push(cooldownBlock('strength', ctx))
  return { blocks, modifiers }
}

export function buildSessionWorkout(type: SessionType, date: DayKey, prog: Programme, p: Profile, opts: BuildOptions = {}): Workout {
  const ctx = ctxFromProfile(p, opts.strictNoEquipment)
  let blocks: WorkoutBlock[] = []
  let modifiers: string[] = []
  let intensity: Workout['intensity'] = 'moderate'
  if (type === 'strength-a' || type === 'strength-b' || type === 'strength-c') {
    const r = buildStrengthBlocks(type, prog, p, opts)
    blocks = r.blocks
    modifiers = r.modifiers
    intensity = opts.deload || opts.lighten ? 'moderate' : 'hard'
  } else if (type === 'conditioning') {
    blocks = [warmupBlock('conditioning', ctx), conditioningCircuit(p, ctx, opts), cooldownBlock('conditioning', ctx, 2)]
    if (opts.lighten || opts.deload) modifiers.push('Reduced rounds and low-impact options today')
    intensity = 'moderate'
  } else {
    const routine = type === 'mobility' ? ROUTINE_MAP['rest-day-flow'] : ROUTINE_MAP['morning-reset']
    blocks = [routineBlock(routine, ctx, (opts.minutes ?? p.sessionMinutes) >= 20 && type === 'mobility' ? 2 : 1)]
    intensity = 'easy'
  }
  if (opts.minutes) {
    const fit = fitToMinutes(blocks, opts.minutes, ctx)
    blocks = fit.blocks
    if (fit.notes.length) modifiers.push(`Fitted to ${opts.minutes} minutes: ${fit.notes.join(', ').toLowerCase()}`)
  }
  return newWorkout({
    date,
    sessionType: type,
    title: SESSION_INFO[type].label,
    purpose: SESSION_PURPOSE[type],
    intensity,
    blocks,
    modifiers,
  })
}

export function newWorkout(w: Pick<Workout, 'date' | 'sessionType' | 'title' | 'purpose' | 'intensity' | 'blocks' | 'modifiers'>): Workout {
  return {
    id: uid('wo'),
    ...w,
    estimatedMinutes: estimateMinutes(w.blocks),
    status: 'active',
    startedAt: new Date().toISOString(),
    activeMs: 0,
    runningSince: null,
    cursor: 0,
    rest: null,
  }
}

export function trackSnapshot(prog: Programme) {
  return Object.values(prog.slots).map((s) => ({ ...s, exercise: getExercise(s.exerciseId) }))
}

export function availableTrackLevels(trackId: TrackId, p: Profile) {
  return availableTrack(trackId, ctxFromProfile(p))
}
