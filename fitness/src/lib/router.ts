import { useSyncExternalStore } from 'react'

/** Minimal hash router: works from any path (file hosting, sub-folders) and offline. */
function current(): string {
  const h = window.location.hash.replace(/^#/, '')
  return h.startsWith('/') ? h : '/'
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute() {
  const path = useSyncExternalStore(subscribe, current, () => '/')
  const [pathname, query = ''] = path.split('?')
  return { path: pathname, parts: pathname.split('/').filter(Boolean), query: new URLSearchParams(query) }
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const depth = (history.state?.forgeDepth as number | undefined) ?? 0
  try {
    if (opts.replace) history.replaceState({ forgeDepth: depth }, '', '#' + to)
    else history.pushState({ forgeDepth: depth + 1 }, '', '#' + to)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } catch {
    // Some embedded or sandboxed frames refuse the History API; plain hash changes still work.
    window.location.hash = to
  }
  window.scrollTo({ top: 0 })
}

/** Go back within the app if we navigated here, otherwise to a sensible parent. */
export function goBack(fallback = '/') {
  if (((history.state?.forgeDepth as number | undefined) ?? 0) > 0) history.back()
  else navigate(fallback, { replace: true })
}
