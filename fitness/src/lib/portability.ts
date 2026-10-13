import { getExercise } from '../engine/library'
import { clearEverything, putKV, putRecords } from './db'
import { DEFAULT_SETTINGS, getState, setState } from './store'
import type { AppData, Workout } from './types'

/**
 * Forge export format (version 1). A single JSON document:
 * {
 *   "format": "forge-export", "version": 1, "exportedAt": ISO timestamp,
 *   "profile": Profile | null, "settings": Settings, "programme": Programme | null,
 *   "workouts": Workout[], "runs": Run[], "checkIns": CheckIn[], "measurements": Measurement[],
 *   "recommendations": Recommendation[], "customExercises": Exercise[]
 * }
 * Units inside the file are always metric (kg, cm, metres, milliseconds), regardless of display units.
 * Progress photos are not included: they stay on this device.
 */
export const EXPORT_FORMAT = 'forge-export'
export const EXPORT_VERSION = 1

export function buildExport() {
  const s = getState()
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: s.profile,
    settings: s.settings,
    programme: s.programme,
    workouts: s.workouts,
    runs: s.runs,
    checkIns: s.checkIns,
    measurements: s.measurements,
    recommendations: s.recommendations,
    customExercises: s.customExercises,
  }
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Share via the iOS share sheet when available (Save to Files, AirDrop…), else download. */
export async function shareOrDownload(filename: string, content: string, type: string) {
  try {
    const file = new File([content], filename, { type })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
  }
  download(filename, content, type)
  return 'downloaded'
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n')

export function workoutsCsv(workouts: Workout[]) {
  const rows: unknown[][] = [['date', 'workout', 'status', 'block', 'exercise', 'set', 'reps', 'seconds', 'meters', 'target_reps', 'target_seconds', 'effort', 'technique', 'session_rpe', 'duration_min']]
  for (const w of [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    for (const b of w.blocks)
      for (const x of b.exercises)
        x.sets.forEach((s, i) =>
          rows.push([w.date, w.title, w.status, b.kind, getExercise(x.exerciseId)?.name ?? x.exerciseId, i + 1, s.reps, s.seconds, s.meters, x.targetReps, x.targetSeconds, x.effort, x.technique, w.rpe, Math.round(w.activeMs / 60000)]),
        )
  }
  return csv(rows)
}

export function runsCsv() {
  const rows: unknown[][] = [['date', 'title', 'source', 'distance_km', 'duration_min', 'pace_min_per_km', 'feel', 'rpe', 'notes']]
  for (const r of [...getState().runs].filter((r) => r.status === 'completed').sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const km = r.distanceM / 1000
    const min = r.activeMs / 60000
    rows.push([r.date, r.title, r.source, km.toFixed(3), min.toFixed(2), km > 0 ? (min / km).toFixed(2) : '', r.feel, r.rpe, r.notes])
  }
  return csv(rows)
}

export class ImportError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function validateList(name: string, v: unknown, required: string[]): Record<string, unknown>[] {
  if (v === undefined) return []
  if (!Array.isArray(v)) throw new ImportError(`“${name}” must be a list`)
  v.forEach((item, i) => {
    if (!isObj(item)) throw new ImportError(`${name}[${i}] is not an object`)
    for (const k of required) if (item[k] === undefined) throw new ImportError(`${name}[${i}] is missing “${k}”`)
    if (typeof item.id !== 'string') throw new ImportError(`${name}[${i}] has an invalid id`)
  })
  return v as Record<string, unknown>[]
}

export function parseImport(text: string): AppData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ImportError('This file isn’t valid JSON.')
  }
  if (!isObj(raw) || raw.format !== EXPORT_FORMAT) throw new ImportError('This doesn’t look like a Forge export file.')
  if (typeof raw.version !== 'number' || raw.version > EXPORT_VERSION) throw new ImportError(`Unsupported export version ${String(raw.version)}.`)
  if (raw.profile !== null && raw.profile !== undefined && (!isObj(raw.profile) || raw.profile.id !== 'me')) throw new ImportError('The profile in this file is invalid.')
  if (raw.programme !== null && raw.programme !== undefined && (!isObj(raw.programme) || typeof raw.programme.startDate !== 'string' || !isObj(raw.programme.slots)))
    throw new ImportError('The programme in this file is invalid.')
  return {
    profile: (raw.profile as AppData['profile']) ?? null,
    settings: { ...DEFAULT_SETTINGS, ...(isObj(raw.settings) ? raw.settings : {}) },
    programme: (raw.programme as AppData['programme']) ?? null,
    workouts: validateList('workouts', raw.workouts, ['date', 'blocks', 'status', 'startedAt']) as unknown as AppData['workouts'],
    runs: validateList('runs', raw.runs, ['date', 'distanceM', 'activeMs', 'status', 'startedAt']) as unknown as AppData['runs'],
    checkIns: validateList('checkIns', raw.checkIns, ['date']) as unknown as AppData['checkIns'],
    measurements: validateList('measurements', raw.measurements, ['date', 'kind', 'value']) as unknown as AppData['measurements'],
    recommendations: validateList('recommendations', raw.recommendations, ['slotId', 'status']) as unknown as AppData['recommendations'],
    customExercises: validateList('customExercises', raw.customExercises, ['name', 'metric']) as unknown as AppData['customExercises'],
  }
}

/** Replace all local data with the imported data. */
export async function applyImport(data: AppData) {
  await clearEverything()
  if (data.profile) await putKV('profile', data.profile)
  await putKV('settings', data.settings)
  if (data.programme) await putKV('programme', data.programme)
  await putRecords('workouts', data.workouts.map((w) => (w.status === 'active' ? { ...w, status: 'ended' as const, runningSince: null } : w)))
  await putRecords('runs', data.runs.filter((r) => r.status === 'completed'))
  await putRecords('checkIns', data.checkIns)
  await putRecords('measurements', data.measurements)
  await putRecords('recommendations', data.recommendations)
  await putRecords('customExercises', data.customExercises)
  setState({ ...data, workouts: data.workouts.map((w) => (w.status === 'active' ? { ...w, status: 'ended' as const, runningSince: null } : w)), runs: data.runs.filter((r) => r.status === 'completed') })
}
