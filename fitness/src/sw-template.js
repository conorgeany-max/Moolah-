/* Forge service worker: precaches the app shell so core features work offline. */
const CACHE = 'forge-__CACHE_VERSION__'
const PRECACHE = __PRECACHE_FILES__

self.addEventListener('install', (event) => {
  // cache: 'reload' bypasses the HTTP cache, so a stale index.html can never be paired with this version's assets.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('forge-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    // App shell: the cached index always matches the cached assets of this version.
    // New versions arrive through a new service worker, never by patching this cache.
    event.respondWith(
      caches.match('./', { cacheName: CACHE }).then((cached) => cached || fetch(req)),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        }),
    ),
  )
})
