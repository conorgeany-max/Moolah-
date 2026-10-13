import type { DayKey, Weekday } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(d: Date = new Date()): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** Monday = 0 … Sunday = 6 */
export function weekdayOf(key: DayKey): Weekday {
  return ((parseDay(key).getDay() + 6) % 7) as Weekday
}

export function mondayOf(key: DayKey): DayKey {
  return addDays(key, -weekdayOf(key))
}

export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86_400_000)
}

export function weekDays(monday: DayKey): DayKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const WEEKDAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function formatDay(key: DayKey, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return parseDay(key).toLocaleDateString(undefined, opts)
}

export function relativeDay(key: DayKey, today: DayKey = dayKey()): string {
  const d = diffDays(key, today)
  if (d === 0) return 'Today'
  if (d === -1) return 'Yesterday'
  if (d === 1) return 'Tomorrow'
  if (d < 0 && d > -7) return WEEKDAY_LONG[weekdayOf(key)]
  return formatDay(key)
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
