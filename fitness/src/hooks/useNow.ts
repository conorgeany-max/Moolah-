import { useEffect, useState } from 'react'

/** Re-render on an interval while `active`; timers derive time from timestamps, not ticks. */
export function useNow(active = true, interval = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), interval)
    const vis = () => setNow(Date.now())
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [active, interval])
  return now
}
