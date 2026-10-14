export interface RoutineItem {
  exerciseId: string
  reps?: number
  seconds?: number
}

export interface MobilityRoutine {
  id: string
  name: string
  goal: string
  minutes: number
  description: string
  items: RoutineItem[]
}

export const MOBILITY_ROUTINES: MobilityRoutine[] = [
  {
    id: 'rest-day-flow', name: 'Rest-day flow', goal: 'Recovery', minutes: 12,
    description: 'Gentle full-body movement for rest days. No strain, just circulation and range.',
    items: [
      { exerciseId: 'cat-cow', reps: 8 },
      { exerciseId: 'thread-the-needle', reps: 5 },
      { exerciseId: 'worlds-greatest-stretch', reps: 3 },
      { exerciseId: 'hip-90-90', reps: 6 },
      { exerciseId: 'open-book', reps: 6 },
      { exerciseId: 'figure-four', seconds: 40 },
      { exerciseId: 'childs-pose', seconds: 45 },
    ],
  },
  {
    id: 'runners-hips', name: 'Runner’s hips & ankles', goal: 'Running', minutes: 10,
    description: 'Hip flexors, glutes, calves and ankles: the areas running loads most.',
    items: [
      { exerciseId: 'leg-swings', reps: 12 },
      { exerciseId: 'hip-circles', reps: 6 },
      { exerciseId: 'ankle-rocks', reps: 10 },
      { exerciseId: 'standing-hip-flexor', seconds: 40 },
      { exerciseId: 'calf-stretch', seconds: 40 },
      { exerciseId: 'figure-four', seconds: 40 },
    ],
  },
  {
    id: 'upper-back-reset', name: 'Upper-back & shoulder reset', goal: 'Posture', minutes: 8,
    description: 'Thoracic rotation and shoulder movement after desk days or heavy pushing.',
    items: [
      { exerciseId: 'arm-circles', reps: 12 },
      { exerciseId: 'floor-slide', reps: 10 },
      { exerciseId: 'open-book', reps: 6 },
      { exerciseId: 'thread-the-needle', reps: 6 },
      { exerciseId: 'chest-opener', seconds: 30 },
      { exerciseId: 'scapular-pushup', reps: 10 },
    ],
  },
  {
    id: 'morning-reset', name: 'Morning reset', goal: 'Daily', minutes: 6,
    description: 'Wake the whole body up in six minutes.',
    items: [
      { exerciseId: 'cat-cow', reps: 6 },
      { exerciseId: 'inchworm', reps: 4 },
      { exerciseId: 'worlds-greatest-stretch', reps: 3 },
      { exerciseId: 'deep-squat-hold', seconds: 30 },
      { exerciseId: 'arm-circles', reps: 10 },
    ],
  },
  {
    id: 'post-run', name: 'Post-run cooldown', goal: 'Running', minutes: 6,
    description: 'Easy stretches to finish a run.',
    items: [
      { exerciseId: 'calf-stretch', seconds: 30 },
      { exerciseId: 'standing-quad', seconds: 30 },
      { exerciseId: 'standing-hamstring', seconds: 30 },
      { exerciseId: 'standing-hip-flexor', seconds: 30 },
    ],
  },
  {
    id: 'deep-flexibility', name: 'Full-body flexibility', goal: 'Flexibility', minutes: 15,
    description: 'Longer holds to work on range across hips, hamstrings and shoulders.',
    items: [
      { exerciseId: 'downward-dog', seconds: 45 },
      { exerciseId: 'half-kneeling-hip-flexor', seconds: 45 },
      { exerciseId: 'standing-hamstring', seconds: 45 },
      { exerciseId: 'butterfly', seconds: 45 },
      { exerciseId: 'figure-four', seconds: 45 },
      { exerciseId: 'cobra', seconds: 30 },
      { exerciseId: 'chest-opener', seconds: 30 },
      { exerciseId: 'childs-pose', seconds: 60 },
    ],
  },
  {
    id: 'strength-warmup', name: 'Strength warm-up', goal: 'Warm-up', minutes: 5,
    description: 'The dynamic warm-up used before strength sessions.',
    items: [
      { exerciseId: 'arm-circles', reps: 10 },
      { exerciseId: 'leg-swings', reps: 10 },
      { exerciseId: 'inchworm', reps: 4 },
      { exerciseId: 'worlds-greatest-stretch', reps: 2 },
      { exerciseId: 'scapular-pushup', reps: 8 },
      { exerciseId: 'bodyweight-squat', reps: 8 },
    ],
  },
  {
    id: 'run-warmup', name: 'Run warm-up', goal: 'Warm-up', minutes: 5,
    description: 'Mobility and drills before quality running.',
    items: [
      { exerciseId: 'leg-swings', reps: 10 },
      { exerciseId: 'hip-circles', reps: 5 },
      { exerciseId: 'ankle-rocks', reps: 8 },
      { exerciseId: 'a-march' },
      { exerciseId: 'butt-kicks' },
    ],
  },
]

export const ROUTINE_MAP = Object.fromEntries(MOBILITY_ROUTINES.map((r) => [r.id, r]))
