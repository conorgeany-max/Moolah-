import { addDays, dayKey, weekdayOf } from './date'
import type { Weekday } from './types'

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function esc(t: string) {
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/**
 * Build an iCalendar file with one weekly repeating event per training day.
 * Web apps on iOS cannot schedule notifications without a push server, so Forge hands reminders
 * to the Calendar app instead. Times are "floating" local times, so they follow you across time zones.
 */
export function remindersIcs(days: Weekday[], time: string, minutes: number, weeks: number, today = dayKey()): string {
  const [hh, mm] = time.split(':').map(Number)
  const now = stamp(new Date())
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Forge//Training reminders//EN', 'CALSCALE:GREGORIAN']
  for (const d of [...days].sort()) {
    let first = today
    while (weekdayOf(first) !== d) first = addDays(first, 1)
    const date = first.replace(/-/g, '')
    const start = `${date}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`
    const endMin = hh * 60 + mm + minutes
    const end = `${date}T${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}${String(endMin % 60).padStart(2, '0')}00`
    lines.push(
      'BEGIN:VEVENT',
      `UID:forge-${BYDAY[d]}-${date}@forge.local`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${endMin >= 24 * 60 ? start : end}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[d]};COUNT=${weeks}`,
      `SUMMARY:${esc('Forge training')}`,
      `DESCRIPTION:${esc('Open Forge to see today’s session.')}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc('Forge training')}`,
      'TRIGGER:-PT10M',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
