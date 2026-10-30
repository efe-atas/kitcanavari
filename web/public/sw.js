// Offline support: the app shell and the last catalog data stay available without a connection.
// Pages and data go to the network first (the catalog changes daily), hashed build assets come from the cache.
const VERSION = 'v3-1'
const SHELL = `kit-shell-${VERSION}`
const DATA = 'kit-data'
const PRECACHE = ['./', './index.html', './favicon.svg', './manifest.webmanifest', './icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).catch(() => undefined))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('kit-shell-') && key !== SHELL) await caches.delete(key)
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'skip-waiting') self.skipWaiting()
})

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(fallback ?? request, response.clone())
    return response
  } catch (e) {
    const hit = await cache.match(fallback ?? request, { ignoreSearch: true })
    if (hit) return hit
    throw e
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, './index.html'))
  } else if (url.pathname.includes('/data/')) {
    event.respondWith(networkFirst(request, DATA))
  } else if (url.pathname.includes('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request))
  }
})
