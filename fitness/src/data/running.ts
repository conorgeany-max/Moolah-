import type { RunSegment } from '../lib/types'

/** Run/walk stages: [run seconds, walk seconds, repeats]. Repeat a stage until it feels manageable. */
export const RUN_WALK_STAGES: [number, number, number][] = [
  [60, 90, 8],
  [90, 90, 7],
  [120, 90, 6],
  [180, 90, 5],
  [300, 120, 4],
  [480, 120, 3],
  [600, 90, 2],
  [900, 90, 2],
  [1200, 0, 1],
]

export interface QualityStage {
  name: string
  kind: 'strides' | 'intervals' | 'tempo' | 'hills'
  purpose: string
  build: () => RunSegment[]
}

const easy = (seconds: number, label = 'Easy run'): RunSegment => ({ kind: 'steady', seconds, label })
const reps = (n: number, hard: number, rec: number, hardLabel: string, recLabel = 'Easy jog'): RunSegment[] =>
  Array.from({ length: n }, (_, i) => [
    { kind: 'hard' as const, seconds: hard, label: `${hardLabel} ${i + 1}/${n}` },
    ...(i < n - 1 || rec ? [{ kind: 'recover' as const, seconds: rec, label: recLabel }] : []),
  ]).flat()

export const QUALITY_STAGES: QualityStage[] = [
  {
    name: 'Easy run with strides', kind: 'strides',
    purpose: 'Strides teach relaxed, fast running without the fatigue of a hard session.',
    build: () => [easy(15 * 60), ...reps(4, 20, 60, 'Stride', 'Walk back')],
  },
  {
    name: 'Short intervals 6 × 1 min', kind: 'intervals',
    purpose: 'Brief, brisk efforts raise aerobic power. Aim for effort 7/10: breathing hard but controlled.',
    build: () => [easy(8 * 60, 'Warm-up jog'), ...reps(6, 60, 120, 'Brisk'), easy(5 * 60, 'Cool-down jog')],
  },
  {
    name: 'Intervals 5 × 2 min', kind: 'intervals',
    purpose: 'Longer efforts at the same controlled-hard effort.',
    build: () => [easy(8 * 60, 'Warm-up jog'), ...reps(5, 120, 120, 'Brisk'), easy(5 * 60, 'Cool-down jog')],
  },
  {
    name: 'Tempo 2 × 6 min', kind: 'tempo',
    purpose: 'Tempo running at a “comfortably hard” effort, where you could say a few words but not chat.',
    build: () => [easy(8 * 60, 'Warm-up jog'), ...reps(2, 360, 180, 'Tempo'), easy(5 * 60, 'Cool-down jog')],
  },
  {
    name: 'Intervals 4 × 3 min', kind: 'intervals',
    purpose: 'Three-minute efforts build your ability to hold a strong pace.',
    build: () => [easy(10 * 60, 'Warm-up jog'), ...reps(4, 180, 120, 'Brisk'), easy(5 * 60, 'Cool-down jog')],
  },
  {
    name: 'Tempo 2 × 10 min', kind: 'tempo',
    purpose: 'Longer tempo blocks for sustained pace.',
    build: () => [easy(8 * 60, 'Warm-up jog'), ...reps(2, 600, 180, 'Tempo'), easy(5 * 60, 'Cool-down jog')],
  },
  {
    name: 'Intervals 5 × 3 min', kind: 'intervals',
    purpose: 'More volume at a controlled-hard effort.',
    build: () => [easy(10 * 60, 'Warm-up jog'), ...reps(5, 180, 90, 'Brisk'), easy(5 * 60, 'Cool-down jog')],
  },
  {
    name: 'Continuous tempo 20 min', kind: 'tempo',
    purpose: 'Twenty minutes of steady, comfortably hard running.',
    build: () => [easy(10 * 60, 'Warm-up jog'), { kind: 'hard', seconds: 1200, label: 'Tempo' }, easy(5 * 60, 'Cool-down jog')],
  },
]

export const HILL_SESSIONS: QualityStage[] = [
  {
    name: 'Hill sprints 6 × 10 s', kind: 'hills',
    purpose: 'Very short uphill sprints build power with low impact. Walk down fully recovered.',
    build: () => [easy(10 * 60, 'Warm-up jog'), ...reps(6, 10, 110, 'Hill sprint', 'Walk down'), easy(5 * 60, 'Cool-down jog')],
  },
  {
    name: 'Hill repeats 6 × 45 s', kind: 'hills',
    purpose: 'Strong uphill efforts build leg strength and aerobic power. Jog or walk down.',
    build: () => [easy(10 * 60, 'Warm-up jog'), ...reps(6, 45, 120, 'Hill rep', 'Jog down'), easy(5 * 60, 'Cool-down jog')],
  },
  {
    name: 'Hill repeats 8 × 45 s', kind: 'hills',
    purpose: 'More uphill reps once six feel comfortable.',
    build: () => [easy(10 * 60, 'Warm-up jog'), ...reps(8, 45, 120, 'Hill rep', 'Jog down'), easy(5 * 60, 'Cool-down jog')],
  },
]

export const EFFORT_GUIDE = {
  easy: 'Conversational: you could speak in full sentences. Effort 3–4 out of 10. Slow down or walk if you can’t.',
  long: 'Easy and steady. Same effort as easy runs; the goal is time on feet, not speed.',
  brisk: 'Controlled-hard: effort 7 out of 10, breathing hard but rhythmic.',
  tempo: 'Comfortably hard: you could say a few words but not hold a conversation. Effort 6–7 out of 10.',
  hills: 'Strong but smooth uphill. Stop the rep if your form breaks down.',
  runwalk: 'Run gently enough to talk. Walk briskly in the walk breaks. Walking is part of the plan, not a failure.',
}
