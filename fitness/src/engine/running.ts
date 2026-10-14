import { EFFORT_GUIDE, HILL_SESSIONS, QUALITY_STAGES, RUN_WALK_STAGES } from '../data/running'
import { clamp } from '../lib/format'
import type { Profile, Programme, Run, RunSegment, RunState, SessionType } from '../lib/types'
import { SESSION_PURPOSE } from './programme'

export interface RunPlan {
  sessionType: SessionType | 'free'
  title: string
  purpose: string
  effort: string
  segments: RunSegment[]
  totalSec: number
  notes: string[]
  warmup: string
  cooldown: string
}

const total = (s: RunSegment[]) => s.reduce((a, x) => a + x.seconds, 0)

export function runWalkSegments(stage: number, repsScale = 1): RunSegment[] {
  const [run, walk, reps] = RUN_WALK_STAGES[clamp(stage, 0, RUN_WALK_STAGES.length - 1)]
  const n = Math.max(1, Math.round(reps * repsScale))
  const segs: RunSegment[] = [{ kind: 'warmup', seconds: 300, label: 'Brisk walk warm-up' }]
  for (let i = 0; i < n; i++) {
    segs.push({ kind: 'run', seconds: run, label: `Run ${i + 1}/${n}` })
    if (walk && i < n - 1) segs.push({ kind: 'walk', seconds: walk, label: 'Walk' })
  }
  segs.push({ kind: 'cooldown', seconds: 300, label: 'Walk cool-down' })
  return segs
}

export function describeRunWalk(stage: number) {
  const [run, walk, reps] = RUN_WALK_STAGES[clamp(stage, 0, RUN_WALK_STAGES.length - 1)]
  const fmt = (s: number) => (s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60} min`)
  return walk ? `${reps} × (run ${fmt(run)} / walk ${fmt(walk)})` : `Run ${fmt(run)} continuously`
}

export interface RunBuildOptions {
  lighten?: boolean
  deload?: boolean
  minutes?: number
  week?: number
}

export function buildRunPlan(type: SessionType, p: Profile, prog: Programme, opts: RunBuildOptions = {}): RunPlan {
  const rs = prog.run
  const notes: string[] = []
  let segments: RunSegment[]
  let title: string
  let effort = EFFORT_GUIDE.easy
  let purpose = SESSION_PURPOSE[type] ?? SESSION_PURPOSE['run-easy']
  const volumeScale = opts.deload ? 0.7 : opts.lighten ? 0.8 : 1
  if (opts.deload) notes.push('Deload week: shorter and easier to absorb recent training')
  if (opts.lighten) notes.push('Lighter today based on your check-in or schedule')

  if (rs.runWalkStage >= 0) {
    const scale = type === 'run-long' ? 1.25 : 1
    segments = runWalkSegments(opts.deload || opts.lighten ? Math.max(0, rs.runWalkStage - 1) : rs.runWalkStage, scale)
    title = `Run/walk · ${describeRunWalk(rs.runWalkStage)}`
    effort = EFFORT_GUIDE.runwalk
    purpose = 'Alternating running and walking lets your heart, lungs, muscles and tendons adapt together. Repeat a stage until it feels manageable, then move on.'
    if (type === 'run-quality') notes.push('Quality sessions start once you can run 20 minutes continuously. Today is another run/walk.')
  } else if (type === 'run-quality' && !opts.lighten && !opts.deload) {
    const hillsAvailable = p.environments.includes('hills')
    const useHills = hillsAvailable && rs.qualityStage >= 1 && (opts.week ?? 1) % 2 === 0
    const stage = useHills ? HILL_SESSIONS[clamp(Math.floor((rs.qualityStage - 1) / 2), 0, HILL_SESSIONS.length - 1)] : QUALITY_STAGES[clamp(rs.qualityStage, 0, QUALITY_STAGES.length - 1)]
    segments = stage.build()
    title = stage.name
    purpose = stage.purpose
    effort = stage.kind === 'tempo' ? EFFORT_GUIDE.tempo : stage.kind === 'hills' ? EFFORT_GUIDE.hills : stage.kind === 'strides' ? EFFORT_GUIDE.easy : EFFORT_GUIDE.brisk
    if (stage.kind !== 'strides') notes.push('Hard efforts are by feel, not a target pace. Stop if anything feels sharp or wrong.')
  } else if (type === 'run-quality') {
    const min = Math.round(rs.easyMinutes * volumeScale)
    segments = [{ kind: 'steady', seconds: min * 60, label: 'Easy run' }]
    title = `Easy run · ${min} min`
    notes.push('Quality session swapped for an easy run today')
  } else if (type === 'run-long') {
    const min = Math.round(rs.longMinutes * volumeScale)
    segments = [{ kind: 'steady', seconds: min * 60, label: 'Long easy run' }]
    title = `Long run · ${min} min`
    effort = EFFORT_GUIDE.long
  } else {
    const min = Math.round(rs.easyMinutes * volumeScale)
    segments = [{ kind: 'steady', seconds: min * 60, label: 'Easy run' }]
    title = `Easy run · ${min} min`
  }

  if (opts.minutes && total(segments) > opts.minutes * 60) {
    const target = opts.minutes * 60
    const f = target / total(segments)
    segments = segments.map((s) => ({ ...s, seconds: Math.max(30, Math.round((s.seconds * f) / 15) * 15) }))
    notes.push(`Shortened to about ${opts.minutes} minutes`)
  }

  return {
    sessionType: type,
    title,
    purpose,
    effort,
    segments,
    totalSec: total(segments),
    notes,
    warmup: rs.runWalkStage >= 0 ? 'The first five minutes are a brisk walk.' : 'Start with 3–5 minutes of walking or very easy jogging, plus leg swings and a few drills.',
    cooldown: 'Finish with a few minutes of walking, then the post-run stretches.',
  }
}

export function freeRunPlan(): RunPlan {
  return {
    sessionType: 'free',
    title: 'Free run',
    purpose: 'An unstructured run. Track it and review distance, time and pace afterwards.',
    effort: EFFORT_GUIDE.easy,
    segments: [],
    totalSec: 0,
    notes: [],
    warmup: 'Start easy for the first few minutes.',
    cooldown: 'Walk for a few minutes to finish.',
  }
}

// ───────────── Progression ─────────────

export interface RunProgressResult {
  run: RunState
  message?: string
}

/** Run/walk: repeat each stage until completed twice without it feeling hard. */
/**
 * Pain overrides everything else. Sharp or worsening pain steps running back straight away;
 * a mild niggle just stops this run counting towards progression.
 */
export function applyPain(rs: RunState, run: Run): RunProgressResult | null {
  if (run.pain === 'pain') {
    const advice = 'Rest from running until you can walk, hop and jog lightly without pain. If it lasts more than a few days, see a physiotherapist.'
    if (rs.runWalkStage >= 0) {
      const stage = Math.max(0, rs.runWalkStage - 1)
      return { run: { ...rs, runWalkStage: stage, stageSuccesses: 0, stageStruggles: 0 }, message: `You reported pain, so running steps back to ${describeRunWalk(stage)}. ${advice}` }
    }
    return {
      run: { ...rs, easyMinutes: Math.max(15, Math.round(rs.easyMinutes * 0.8)), longMinutes: Math.max(20, Math.round(rs.longMinutes * 0.8)) },
      message: `You reported pain, so run durations drop by about 20% and won't increase this week. ${advice}`,
    }
  }
  if (run.pain === 'niggle') {
    return { run: rs, message: 'Niggle noted. Running holds steady instead of progressing. Tell Forge again after your next run.' }
  }
  return null
}

export function afterRunWalk(rs: RunState, run: Run): RunProgressResult {
  if (rs.runWalkStage < 0) return { run: rs }
  const success = run.completedPlan !== false && run.feel !== 'hard'
  if (success) {
    const successes = rs.stageSuccesses + 1
    if (successes >= 2) {
      const next = rs.runWalkStage + 1
      if (next >= RUN_WALK_STAGES.length) {
        return {
          run: { ...rs, runWalkStage: -1, easyMinutes: 20, longMinutes: 25, stageSuccesses: 0, stageStruggles: 0, lastProgressed: 'volume' },
          message: 'You’ve graduated from run/walk. Your easy runs are now 20 minutes of continuous, conversational running.',
        }
      }
      return {
        run: { ...rs, runWalkStage: next, stageSuccesses: 0, stageStruggles: 0 },
        message: `Run/walk stage complete twice and manageable. Next stage: ${describeRunWalk(next)}.`,
      }
    }
    return { run: { ...rs, stageSuccesses: successes, stageStruggles: 0 }, message: 'One more comfortable run at this stage and you’ll move on.' }
  }
  const struggles = rs.stageStruggles + 1
  if (struggles >= 2 && rs.runWalkStage > 0) {
    return {
      run: { ...rs, runWalkStage: rs.runWalkStage - 1, stageSuccesses: 0, stageStruggles: 0 },
      message: `Two tough runs in a row, so you’ll step back to ${describeRunWalk(rs.runWalkStage - 1)} for a little longer. That’s normal.`,
    }
  }
  return { run: { ...rs, stageSuccesses: 0, stageStruggles: struggles }, message: 'You’ll repeat this stage next time. Repeating is part of the plan.' }
}

/**
 * Weekly review for continuous runners. Volume and intensity never increase in the
 * same week: if the last change was volume, the next one is intensity, and vice versa.
 */
export function reviewRunWeek(prog: Programme, runsInWeek: Run[], plannedRuns: number, week: number, isDeload: boolean): RunProgressResult {
  const rs = prog.run
  if (rs.runWalkStage >= 0 || week <= rs.reviewedWeek) return { run: rs }
  const base = { ...rs, reviewedWeek: week }
  if (isDeload) return { run: base, message: 'Deload week: run volume held steady.' }
  const done = runsInWeek.filter((r) => r.status === 'completed')
  if (done.some((r) => r.pain === 'pain' || r.pain === 'niggle')) return { run: base, message: 'You reported discomfort after a run last week, so run volume and intensity are held.' }
  if (plannedRuns === 0) return { run: base }
  const completion = done.length / plannedRuns
  const easyHard = done.filter((r) => r.sessionType !== 'run-quality' && r.feel === 'hard').length
  if (completion < 0.6 || easyHard >= 2) {
    if (easyHard >= 2) {
      return {
        run: { ...base, easyMinutes: Math.max(15, Math.round(rs.easyMinutes * 0.9)), longMinutes: Math.max(20, Math.round(rs.longMinutes * 0.9)) },
        message: 'Several easy runs felt hard last week, so run durations are reduced slightly.',
      }
    }
    return { run: base, message: 'Run volume held: progress resumes after a fuller week.' }
  }
  const feltOk = done.every((r) => r.feel !== 'hard' || r.sessionType === 'run-quality')
  if (!feltOk) return { run: base }
  const hasQuality = done.some((r) => r.sessionType === 'run-quality')
  const progressIntensity = rs.lastProgressed === 'volume' && hasQuality && rs.qualityStage < QUALITY_STAGES.length - 1
  if (progressIntensity) {
    const q = done.find((r) => r.sessionType === 'run-quality')
    if (q && q.feel !== 'hard') {
      return {
        run: { ...base, qualityStage: rs.qualityStage + 1, lastProgressed: 'intensity', lastProgressedWeek: week },
        message: `Quality session progresses to “${QUALITY_STAGES[rs.qualityStage + 1].name}”. Run durations stay the same this week.`,
      }
    }
  }
  const longNext = Math.min(Math.round(rs.longMinutes * 1.1), rs.longMinutes + 10, 120)
  const easyNext = Math.min(rs.easyMinutes + 2, 60)
  return {
    run: { ...base, longMinutes: Math.max(longNext, rs.longMinutes + 2), easyMinutes: easyNext, lastProgressed: 'volume', lastProgressedWeek: week },
    message: `Run volume up about 10%: long run ${Math.max(longNext, rs.longMinutes + 2)} min, easy runs ${easyNext} min. Intensity stays the same this week.`,
  }
}

// ───────────── GPS helpers ─────────────

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Points worse than this horizontal accuracy are not used for distance. */
export const MAX_ACCURACY_M = 35

/**
 * Distance increment for a new GPS fix. Ignores inaccurate fixes, sub-noise jitter and
 * implausible jumps (faster than ~12 m/s), so stationary drift doesn't inflate distance.
 */
export function gpsIncrement(prev: { lat: number; lon: number; t: number; acc: number } | undefined, next: { lat: number; lon: number; t: number; acc: number }): number {
  if (!prev || next.acc > MAX_ACCURACY_M) return 0
  const d = haversine(prev, next)
  const dt = (next.t - prev.t) / 1000
  if (dt <= 0) return 0
  if (d < Math.max(3, Math.min(prev.acc, next.acc) * 0.5)) return 0
  if (d / dt > 12) return 0
  return d
}

/** Fastest 1 km within a GPS track, from cumulative distance/time. */
export function bestKilometreSec(points: { lat: number; lon: number; t: number; acc: number }[]): number | undefined {
  const cum: { d: number; t: number }[] = []
  let d = 0
  let last: (typeof points)[number] | undefined
  for (const p of points) {
    const inc = gpsIncrement(last, p)
    if (p.acc <= MAX_ACCURACY_M) {
      d += inc
      last = p
      cum.push({ d, t: p.t })
    }
  }
  if (d < 1000) return undefined
  let best = Infinity
  let j = 0
  for (let i = 0; i < cum.length; i++) {
    while (j < cum.length && cum[j].d - cum[i].d < 1000) j++
    if (j >= cum.length) break
    const sec = (cum[j].t - cum[i].t) / 1000
    if (sec > 0 && sec < best) best = sec
  }
  return isFinite(best) ? best : undefined
}
