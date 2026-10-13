import type { Units } from './types'

export const KM_PER_MI = 1.609344
export const LB_PER_KG = 2.2046226218
export const CM_PER_IN = 2.54

export const DEFAULT_UNITS: Units = { weight: 'kg', distance: 'km', height: 'cm', length: 'cm' }

export function formatDistance(meters: number, units: Units, digits = 2): string {
  const v = units.distance === 'km' ? meters / 1000 : meters / 1000 / KM_PER_MI
  return `${v.toFixed(digits)} ${units.distance}`
}

export function distanceValue(meters: number, units: Units): number {
  return units.distance === 'km' ? meters / 1000 : meters / 1000 / KM_PER_MI
}

export function toMeters(value: number, units: Units): number {
  return units.distance === 'km' ? value * 1000 : value * KM_PER_MI * 1000
}

/** Pace in seconds per km or per mile, depending on units. */
export function paceValue(secPerKm: number, units: Units): number {
  return units.distance === 'km' ? secPerKm : secPerKm * KM_PER_MI
}

export function formatPace(secPerKm: number | undefined | null, units: Units): string {
  if (!secPerKm || !isFinite(secPerKm) || secPerKm <= 0) return '—'
  const s = Math.round(paceValue(secPerKm, units))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /${units.distance}`
}

export function formatWeight(kg: number, units: Units): string {
  return units.weight === 'kg' ? `${kg.toFixed(1)} kg` : `${(kg * LB_PER_KG).toFixed(1)} lb`
}

export function weightValue(kg: number, units: Units) {
  return units.weight === 'kg' ? kg : kg * LB_PER_KG
}

export function weightToKg(v: number, units: Units) {
  return units.weight === 'kg' ? v : v / LB_PER_KG
}

export function lengthValue(cm: number, units: Units) {
  return units.length === 'cm' ? cm : cm / CM_PER_IN
}

export function lengthToCm(v: number, units: Units) {
  return units.length === 'cm' ? v : v * CM_PER_IN
}

export function formatHeight(cm: number, units: Units) {
  if (units.height === 'cm') return `${Math.round(cm)} cm`
  const totalIn = cm / CM_PER_IN
  const ft = Math.floor(totalIn / 12)
  const inch = Math.round(totalIn - ft * 12)
  return `${ft}′${inch}″`
}
