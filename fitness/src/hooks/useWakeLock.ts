import { useEffect, useState } from 'react'

type Sentinel = { release: () => Promise<void>; addEventListener: (t: 'release', cb: () => void) => void }

/** Keep the screen on during workouts and runs (Screen Wake Lock API, iOS 16.4+). */
export function useWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false)
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  useEffect(() => {
    if (!enabled || !supported) return
    let sentinel: Sentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        sentinel = (await (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock.request('screen')) as Sentinel
        if (cancelled) return sentinel.release()
        setActive(true)
        sentinel.addEventListener('release', () => setActive(false))
      } catch {
        setActive(false)
      }
    }
    request()
    const onVis = () => document.visibilityState === 'visible' && request()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      sentinel?.release().catch(() => undefined)
      setActive(false)
    }
  }, [enabled, supported])
  return { supported, active }
}
