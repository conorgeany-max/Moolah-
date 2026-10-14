import type { CheckIn } from '../lib/types'

export type Readiness = 'good' | 'ok' | 'low'

export interface ReadinessResult {
  level: Readiness
  score: number
  advice: string
  suggestLighter: boolean
}

/**
 * Rule-based readiness from a self-reported check-in. It is a nudge, not a measurement:
 * how you feel is the input, and the app suggests (never forces) a lighter session.
 */
export function readinessOf(c: CheckIn | undefined): ReadinessResult | null {
  if (!c) return null
  if (c.pain) {
    return {
      level: 'low', score: 0, suggestLighter: true,
      advice: 'You reported pain. Sharp, worsening or joint pain is a reason to stop and seek qualified advice; train around it only if it is clearly mild muscle soreness.',
    }
  }
  let score = c.energy * 2 + (6 - c.soreness) * 2 + (c.stress ? 6 - c.stress : 3)
  if (c.sleepHours !== undefined) score += c.sleepHours >= 7 ? 3 : c.sleepHours >= 6 ? 1.5 : 0
  else score += 1.5
  // max = 10 + 10 + 5 + 3 = 28
  if (score >= 19) return { level: 'good', score, suggestLighter: false, advice: 'You’re feeling good. Train as planned.' }
  if (score >= 13) return { level: 'ok', score, suggestLighter: false, advice: 'A normal day. Train as planned and listen to your body.' }
  return {
    level: 'low', score, suggestLighter: true,
    advice: 'Energy is low or soreness high. A lighter session (fewer sets, no jumps, easy running) will still move you forward.',
  }
}

/** Suggest an early deload if three of the last five check-ins were low. */
export function shouldSuggestDeload(checkIns: CheckIn[]): boolean {
  const recent = [...checkIns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  return recent.filter((c) => readinessOf(c)?.level === 'low').length >= 3
}
