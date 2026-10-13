import { useSyncExternalStore, useRef } from 'react'
import { registerCustomExercises } from '../engine/library'
import { COLLECTIONS, loadEverything, requestPersistence } from './db'
import type { AppData, CheckIn, Exercise, Measurement, Profile, Programme, Recommendation, Run, Settings, Workout } from './types'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  largeText: false,
  reducedMotion: false,
  sound: true,
  voice: false,
  haptics: true,
  outdoorMode: false,
  keepAwake: true,
  autoStartRest: true,
  weekStartsMonday: true,
}

export interface State extends AppData {
  status: 'loading' | 'ready' | 'error'
  error?: string
  persisted?: boolean
}

const empty: State = {
  status: 'loading',
  profile: null,
  settings: DEFAULT_SETTINGS,
  programme: null,
  workouts: [],
  runs: [],
  checkIns: [],
  measurements: [],
  recommendations: [],
  customExercises: [],
}

let state: State = empty
const listeners = new Set<() => void>()

export function getState(): State {
  return state
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...p }
  if (p.customExercises) registerCustomExercises(p.customExercises)
  listeners.forEach((l) => l())
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Subscribe to a slice of state. The selector result is compared shallowly. */
export function useStore<T>(selector: (s: State) => T): T {
  const cache = useRef<{ value: T } | null>(null)
  const get = () => {
    const value = selector(state)
    if (cache.current && shallowEqual(cache.current.value, value)) return cache.current.value
    cache.current = { value }
    return value
  }
  return useSyncExternalStore(subscribe, get, get)
}

function shallowEqual(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

const byDateDesc = <T extends { startedAt?: string; createdAt?: string; date: string }>(a: T, b: T) =>
  (b.startedAt ?? b.createdAt ?? b.date).localeCompare(a.startedAt ?? a.createdAt ?? a.date)

export async function initStore() {
  try {
    const { kv, collections } = await loadEverything()
    const settings = { ...DEFAULT_SETTINGS, ...((kv.settings as Settings) ?? {}) }
    const custom = (collections.customExercises as Exercise[]) ?? []
    registerCustomExercises(custom)
    setState({
      status: 'ready',
      profile: (kv.profile as Profile) ?? null,
      settings,
      programme: (kv.programme as Programme) ?? null,
      workouts: ((collections.workouts as Workout[]) ?? []).sort(byDateDesc),
      runs: ((collections.runs as Run[]) ?? []).sort(byDateDesc),
      checkIns: ((collections.checkIns as CheckIn[]) ?? []).sort(byDateDesc),
      measurements: ((collections.measurements as Measurement[]) ?? []).sort(byDateDesc),
      recommendations: ((collections.recommendations as Recommendation[]) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      customExercises: custom,
    })
    requestPersistence().then((persisted) => setState({ persisted }))
  } catch (e) {
    setState({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

export { COLLECTIONS }
