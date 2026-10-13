/**
 * Forge data model. Every persisted record has a stable string id and an ISO timestamp.
 * Dates without a time component ("day keys") use the local calendar format YYYY-MM-DD.
 */

export type DayKey = string // YYYY-MM-DD, local calendar date
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Monday … 6 = Sunday

export type Goal = 'muscle' | 'strength' | 'fitness' | 'fatloss' | 'endurance' | 'mobility'
export type Environment = 'backyard' | 'street' | 'park' | 'hills' | 'stairs' | 'paths' | 'bar' | 'wall'
export type Experience = 'new' | 'some' | 'regular' | 'advanced'
export type RunLevel = 'none' | 'runwalk' | 'continuous20' | 'fivek' | 'tenk'
export type CoachingStyle = 'calm' | 'direct' | 'detailed'
export type IntensityPref = 'gentle' | 'moderate' | 'ambitious'

/** Movement tags a user can choose to avoid. Exercises carrying a tag are filtered out. */
export type AvoidTag =
  | 'jumping'
  | 'kneeling'
  | 'wrist-load'
  | 'deep-knee-bend'
  | 'overhead'
  | 'running'
  | 'spinal-flexion'
  | 'lying-prone'

export interface Units {
  weight: 'kg' | 'lb'
  distance: 'km' | 'mi'
  height: 'cm' | 'ftin'
  length: 'cm' | 'in'
}

export interface Profile {
  id: 'me'
  createdAt: string
  updatedAt: string
  name?: string
  age?: number
  heightCm?: number
  weightKg?: number
  units: Units
  experience: Experience
  runLevel: RunLevel
  comfortableRunKm?: number
  easyPaceSecPerKm?: number
  goals: Goal[]
  trainingDays: Weekday[]
  sessionMinutes: number
  environments: Environment[]
  capabilities: {
    pushups?: number // max strict push-ups in one set
    kneePushups?: number
    squats?: number // max bodyweight squats
    plankSec?: number
    runMinutes?: number // longest continuous run
  }
  avoid: AvoidTag[]
  injuryNotes: string
  coaching: CoachingStyle
  intensity: IntensityPref
  disclaimerAcceptedAt?: string
  onboardedAt?: string
}

export interface Settings {
  theme: 'dark' | 'light' | 'system'
  largeText: boolean
  reducedMotion: boolean
  sound: boolean
  voice: boolean
  haptics: boolean
  outdoorMode: boolean
  keepAwake: boolean
  autoStartRest: boolean
  /** Local time (HH:MM) used when exporting calendar reminders. */
  reminderTime?: string
  weekStartsMonday: true
}

// ───────────────────────── Exercise library ─────────────────────────

export type ExerciseCategory =
  | 'push'
  | 'legs'
  | 'unilateral'
  | 'hinge'
  | 'core'
  | 'pull'
  | 'jump'
  | 'conditioning'
  | 'running-drill'
  | 'mobility'
  | 'stretch'

export type MovementPattern =
  | 'horizontal-push'
  | 'vertical-push'
  | 'squat'
  | 'lunge'
  | 'single-leg'
  | 'hinge'
  | 'calf'
  | 'anti-extension'
  | 'anti-lateral'
  | 'flexion'
  | 'extension'
  | 'scapular'
  | 'pull'
  | 'plyometric'
  | 'locomotion'
  | 'gait'
  | 'mobility'
  | 'stretch'

/** What the movement needs beyond the floor. 'none' is the default for nearly everything. */
export type Equipment = 'none' | 'wall' | 'stable-surface' | 'step' | 'hill' | 'stairs' | 'bar' | 'low-bar'

export type Metric = 'reps' | 'time' | 'distance'

export type FigureKey =
  | 'pushup'
  | 'incline-pushup'
  | 'knee-pushup'
  | 'decline-pushup'
  | 'pike'
  | 'squat'
  | 'lunge'
  | 'split-squat'
  | 'single-leg-squat'
  | 'bridge'
  | 'calf'
  | 'plank'
  | 'side-plank'
  | 'hollow'
  | 'leg-raise'
  | 'dead-bug'
  | 'bird-dog'
  | 'prone-raise'
  | 'hang'
  | 'row'
  | 'jump'
  | 'burpee'
  | 'climber'
  | 'crawl'
  | 'run'
  | 'skip'
  | 'stretch-hinge'
  | 'stretch-lunge'
  | 'stretch-floor'
  | 'standing-arms'
  | 'rotation'
  | 'hinge-stand'

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  pattern: MovementPattern
  muscles: string[]
  equipment: Equipment
  /** If the exercise needs a feature you may not have, suggest this alternative. */
  alternativeId?: string
  difficulty: 1 | 2 | 3 | 4 | 5
  metric: Metric
  perSide?: boolean
  defaults: { sets: number; reps?: [number, number]; seconds?: [number, number]; meters?: number; restSec: number }
  intensity: 'low' | 'moderate' | 'high'
  summary: string
  steps: string[]
  cues: string[]
  breathing: string
  mistakes: string[]
  safety: string[]
  easierId?: string
  harderId?: string
  avoidTags: AvoidTag[]
  figure: FigureKey
}

export interface ProgressionTrack {
  id: TrackId
  name: string
  description: string
  exerciseIds: string[]
}

export type TrackId =
  | 'push'
  | 'vertical-push'
  | 'squat'
  | 'single-leg'
  | 'lunge'
  | 'hinge'
  | 'calf'
  | 'plank'
  | 'hollow'
  | 'side-plank'
  | 'leg-raise'
  | 'upper-back'
  | 'bar-pull'
  | 'jump'
  | 'conditioning'

// ───────────────────────── Programme ─────────────────────────

export type SessionType =
  | 'strength-a'
  | 'strength-b'
  | 'strength-c'
  | 'run-easy'
  | 'run-quality'
  | 'run-long'
  | 'conditioning'
  | 'mobility'
  | 'rest'

export interface SlotState {
  slotId: string
  trackId: TrackId
  exerciseId: string
  sets: number
  /** For rep-based exercises: the current target per set within the range. */
  target: number
  range: [number, number]
  metric: Metric
}

export interface RunState {
  /** Run/walk programme stage (0-based). -1 once the runner has graduated to continuous running. */
  runWalkStage: number
  easyMinutes: number
  longMinutes: number
  qualityStage: number
  /** The dimension progressed most recently, so volume and intensity never rise together. */
  lastProgressed: 'volume' | 'intensity' | 'none'
  lastProgressedWeek: number
  /** Last programme week whose runs were reviewed for progression. */
  reviewedWeek: number
  /** Consecutive successful completions of the current run/walk stage. */
  stageSuccesses: number
  stageStruggles: number
}

export interface DayOverride {
  type?: SessionType
  lighten?: boolean
  skipped?: boolean
  note?: string
}

export interface Programme {
  id: string
  createdAt: string
  startDate: DayKey // Monday of week 1
  /** The day the programme actually began. Earlier days in week 1 are not counted as missed. */
  firstDay?: DayKey
  weeks: number
  template: Partial<Record<Weekday, SessionType>>
  deloadWeeks: number[]
  /** Deload weeks the user accepted early because of fatigue. */
  extraDeloadWeeks: number[]
  overrides: Record<DayKey, DayOverride>
  slots: Record<string, SlotState>
  run: RunState
  rationale: string[]
}

// ───────────────────────── Logged training ─────────────────────────

export type Effort = 'easy' | 'solid' | 'max'
export type Technique = 'clean' | 'some' | 'breakdown'
export type Feel = 'easy' | 'moderate' | 'hard'

export interface SetLog {
  id: string
  reps?: number
  seconds?: number
  meters?: number
  completedAt: string
  restTakenSec?: number
}

export interface ExerciseLog {
  id: string
  exerciseId: string
  slotId?: string
  originalExerciseId?: string // set when substituted
  targetSets: number
  targetReps?: number
  targetSeconds?: number
  restSec: number
  perSide?: boolean
  sets: SetLog[]
  effort?: Effort
  technique?: Technique
  skipped?: boolean
  note?: string
}

export interface WorkoutBlock {
  kind: 'warmup' | 'main' | 'finisher' | 'cooldown'
  title: string
  exercises: ExerciseLog[]
  /** Circuit blocks loop exercises for `rounds` instead of straight sets. */
  rounds?: number
}

export interface Workout {
  id: string
  date: DayKey
  sessionType: SessionType | 'custom' | 'quick' | 'generated'
  title: string
  purpose: string
  intensity: 'easy' | 'moderate' | 'hard'
  estimatedMinutes: number
  blocks: WorkoutBlock[]
  status: 'active' | 'completed' | 'ended'
  startedAt: string
  completedAt?: string
  /** Accumulated active time in ms, excluding pauses. */
  activeMs: number
  /** When the current running segment began (null while paused). */
  runningSince: number | null
  pausedAt?: number | null
  rpe?: number // 1-10 session RPE
  feel?: Feel
  notes?: string
  modifiers: string[] // human-readable notes about adjustments applied
  outdoorMode?: boolean
  /** Index into the flattened step list (see engine/steps.ts). */
  cursor: number
  rest: RestState | null
  /** Personal records set in this workout, computed when it is finished. */
  records?: RecordHit[]
}

export interface RestState {
  startedAt: number
  durationSec: number
  /** Remaining ms when paused; null while counting down. */
  pausedRemainingMs: number | null
}

export interface RecordHit {
  exerciseId: string
  kind: 'reps' | 'hold' | 'first'
  value: number
  previous?: number
}

export interface GeoPoint {
  t: number
  lat: number
  lon: number
  acc: number
  alt?: number | null
}

export interface RunSegment {
  kind: 'warmup' | 'run' | 'walk' | 'hard' | 'recover' | 'cooldown' | 'steady'
  seconds: number
  label: string
}

export interface Run {
  id: string
  date: DayKey
  sessionType: SessionType | 'manual' | 'free'
  title: string
  source: 'gps' | 'manual' | 'timer'
  startedAt: string
  completedAt?: string
  status: 'active' | 'completed'
  distanceM: number
  activeMs: number
  runningSince: number | null
  points: GeoPoint[]
  /** Planned interval structure, if guided. */
  plan?: RunSegment[]
  feel?: Feel
  rpe?: number
  notes?: string
  completedPlan?: boolean
  bestKmSec?: number
}

export interface CheckIn {
  id: string
  date: DayKey
  energy: 1 | 2 | 3 | 4 | 5
  soreness: 1 | 2 | 3 | 4 | 5
  sleepHours?: number
  stress?: 1 | 2 | 3 | 4 | 5
  pain?: boolean
  createdAt: string
}

export interface Measurement {
  id: string
  date: DayKey
  kind: 'weight' | 'waist' | 'chest' | 'hips' | 'arm' | 'thigh' | 'restingHr'
  value: number // stored in kg / cm / bpm
  createdAt: string
}

export interface ProgressPhoto {
  id: string
  date: DayKey
  createdAt: string
  blob: Blob
  note?: string
}

export interface Recommendation {
  id: string
  createdAt: string
  slotId: string
  kind: 'harder-variation' | 'more-reps' | 'longer-hold' | 'add-set' | 'easier-variation' | 'hold'
  fromExerciseId: string
  toExerciseId: string
  fromTarget: number
  toTarget: number
  toSets?: number
  reason: string
  status: 'pending' | 'accepted' | 'dismissed' | 'auto'
}

export interface Milestone {
  id: string
  title: string
  detail: string
  achievedAt?: string
}

export interface AppData {
  profile: Profile | null
  settings: Settings
  programme: Programme | null
  workouts: Workout[]
  runs: Run[]
  checkIns: CheckIn[]
  measurements: Measurement[]
  recommendations: Recommendation[]
  customExercises: Exercise[]
}
