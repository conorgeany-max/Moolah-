type Listener = (waiting: ServiceWorker | null) => void
let listeners: Listener[] = []
let waiting: ServiceWorker | null = null

export function onUpdateAvailable(l: Listener) {
  listeners.push(l)
  l(waiting)
  return () => {
    listeners = listeners.filter((x) => x !== l)
  }
}

function setWaiting(w: ServiceWorker | null) {
  waiting = w
  listeners.forEach((l) => l(w))
}

/** Registers the offline service worker in production builds only. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' })
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(nw)
        })
      })
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        window.location.reload()
      })
      // Check for updates when the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => undefined))
    } catch (e) {
      console.warn('Service worker registration failed', e)
    }
  })
}

export function applyUpdate() {
  waiting?.postMessage('skip-waiting')
}

export function isOfflineReady() {
  return !!navigator.serviceWorker?.controller
}
