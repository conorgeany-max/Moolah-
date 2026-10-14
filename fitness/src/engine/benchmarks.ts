import { dayKey, diffDays } from '../lib/date'
import type { Benchmark, DayKey, Programme } from '../lib/types'
import { isDeloadWeek, programmeWeek } from './schedule'

export type RetestDue = 'baseline' | 'retest' | null

/**
 * When to suggest a re-test. A baseline any time before the first one; afterwards in deload or
 * every-fourth weeks (you're freshest then), and never more often than every 25 days.
 */
export function retestDue(p: Programme | null, benchmarks: Benchmark[], today: DayKey = dayKey()): RetestDue {
  if (!p) return null
  const week = programmeWeek(p, today)
  if (week < 1) return null
  const last = benchmarks.reduce<string | undefined>((m, b) => (!m || b.date > m ? b.date : m), undefined)
  if (!last) return 'baseline'
  const since = diffDays(today, last)
  if (since < 25) return null
  if (since >= 35 || week % 4 === 0 || isDeloadWeek(p, week)) return 'retest'
  return null
}

export interface BenchmarkDelta {
  key: 'pushups' | 'plankSec' | 'squats60' | 'kmSec'
  label: string
  first?: number
  latest?: number
  /** Positive means better (for the 1 km time, faster). */
  change?: number
}

export const BENCHMARK_LABEL: Record<BenchmarkDelta['key'], string> = {
  pushups: 'Max push-ups',
  plankSec: 'Longest plank',
  squats60: 'Squats in 60 s',
  kmSec: '1 km time',
}

/** Compare the latest result for each test with the first one. Push-ups compare only within the same variation. */
export function benchmarkDeltas(list: Benchmark[]): BenchmarkDelta[] {
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  return (Object.keys(BENCHMARK_LABEL) as BenchmarkDelta['key'][]).map((key) => {
    const withValue = sorted.filter((b) => b[key] !== undefined)
    const latestB = withValue.at(-1)
    const pool = key === 'pushups' && latestB ? withValue.filter((b) => b.pushupExerciseId === latestB.pushupExerciseId) : withValue
    const first = pool[0]?.[key]
    const latest = latestB?.[key]
    const change = first !== undefined && latest !== undefined && pool.length > 1 ? (key === 'kmSec' ? first - latest : latest - first) : undefined
    return { key, label: BENCHMARK_LABEL[key], first, latest, change }
  })
}
