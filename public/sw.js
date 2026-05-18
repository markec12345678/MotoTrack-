// MotoTrack Service Worker v2 — Offline-first with smart caching
// Critical for Balkan motorcyclists where mobile signal is often unavailable

const CACHE_VERSION = 'mototrack-v2'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const API_CACHE = `${CACHE_VERSION}-api`
const TILE_CACHE = `${CACHE_VERSION}-tiles`
const XTP = '3002'

// Maximum cache entries
const MAX_API_ENTRIES = 50
const MAX_TILE_ENTRIES = 300

// Static assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// Install: precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Precache what we can, don't fail on errors
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(() => {
            // Silently fail — we'll cache on first request
          })
        )
      )
    }).then(() => self.skipWaiting())
  )
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('mototrack-') && name !== STATIC_CACHE && name !== API_CACHE && name !== TILE_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// Helper: add XTransformPort to same-origin requests
function addXTP(url) {
  if (url.origin !== self.location.origin) return url
  if (!url.searchParams.has('XTransformPort')) {
    url.searchParams.set('XTransformPort', XTP)
  }
  return url
}

// Helper: trim cache to max entries (LRU-like)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  // Delete oldest entries (first in = first out)
  const toDelete = keys.slice(0, keys.length - maxEntries)
  await Promise.all(toDelete.map(key => cache.delete(key)))
}

// Helper: is this a map tile request?
function isTileRequest(url) {
  const tileHosts = ['tile.openstreetmap.org', 'tiles.wmflabs.org', 'a.tile.openstreetmap.org',
    'b.tile.openstreetmap.org', 'c.tile.openstreetmap.org', 'api.mapbox.com',
    'demotiles.maplibre.org', 'basemaps.cartocdn.com', 'stamen-tiles.a.ssl.fastly.net']
  return tileHosts.some(host => url.hostname.includes(host))
}

// Helper: is this an API request we should cache?
function isCacheableApi(url) {
  const cacheablePaths = ['/api/init', '/api/rides', '/api/routes', '/api/weather',
    '/api/balkan-roads', '/api/fuel', '/api/settings', '/api/stats',
    '/api/leaderboard', '/api/challenges', '/api/events', '/api/camps',
    '/api/pois', '/api/user', '/api/seed', '/api/navigation',
    '/api/route-recommendations', '/api/service-centers', '/api/smart-consumption',
    '/api/maintenance', '/api/expenses', '/api/emergency-contacts', '/api/speed-settings']
  return cacheablePaths.some(path => url.pathname.startsWith(path))
}

// Helper: is this a static asset?
function isStaticAsset(url) {
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|webp)$/)
    || url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/_next/image')
}

// Fetch handler with smart caching strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET requests (POST, PUT, DELETE — don't cache)
  if (event.request.method !== 'GET') {
    // For API mutations when offline, we could queue them — but that's handled by OfflineSyncQueue
    event.respondWith(
      fetch(addXTP(url), {
        method: event.request.method,
        headers: event.request.headers,
        body: event.request.body,
        mode: event.request.mode,
        credentials: event.request.credentials,
        redirect: event.request.redirect,
      }).catch(() => {
        return new Response(JSON.stringify({ error: 'Brez povezave', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )
    return
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return

  // Skip OSRM routing and external API calls (not cacheable)
  if (url.hostname.includes('router.project-osrm.org')) return

  // Map tiles: Stale-while-revalidate (show cached, update in background)
  if (isTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request)
        const fetchPromise = fetch(addXTP(url), { credentials: event.request.credentials })
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone())
              trimCache(TILE_CACHE, MAX_TILE_ENTRIES)
            }
            return response
          })
          .catch(() => cached)
        return cached || fetchPromise
      })
    )
    return
  }

  // Same-origin requests only for the rest
  if (url.origin !== self.location.origin) return

  // Static assets: Cache-first (fast load, long-lived)
  if (isStaticAsset(url)) {
    const modifiedUrl = addXTP(url)
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(modifiedUrl)
        if (cached) return cached
        try {
          const response = await fetch(modifiedUrl)
          if (response.ok) {
            cache.put(modifiedUrl, response.clone())
          }
          return response
        } catch {
          // Fallback for HTML navigation when offline
          if (event.request.mode === 'navigate') {
            const fallback = await cache.match('/')
            if (fallback) return fallback
          }
          return new Response('Offline', { status: 503 })
        }
      })
    )
    return
  }

  // API requests: Network-first (fresh data preferred, cache fallback)
  if (url.pathname.startsWith('/api/')) {
    if (isCacheableApi(url)) {
      const modifiedUrl = addXTP(url)
      event.respondWith(
        caches.open(API_CACHE).then(async (cache) => {
          try {
            const response = await fetch(modifiedUrl, {
              credentials: event.request.credentials,
            })
            if (response.ok) {
              cache.put(modifiedUrl, response.clone())
              trimCache(API_CACHE, MAX_API_ENTRIES)
            }
            return response
          } catch {
            // Network failed — try cache
            const cached = await cache.match(modifiedUrl)
            if (cached) {
              // Add header to indicate stale data
              const headers = new Headers(cached.headers)
              headers.set('X-Cache-Status', 'stale')
              return new Response(cached.body, { ...cached, headers })
            }
            return new Response(JSON.stringify({ error: 'Brez povezave', offline: true }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            })
          }
        })
      )
      return
    }
    // Non-cacheable API: just add XTP and pass through
    const modifiedUrl = addXTP(url)
    event.respondWith(
      fetch(modifiedUrl, {
        credentials: event.request.credentials,
      }).catch(() => {
        return new Response(JSON.stringify({ error: 'Brez povezave', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )
    return
  }

  // HTML navigation: Network-first with cache fallback
  if (event.request.mode === 'navigate') {
    const modifiedUrl = addXTP(url)
    event.respondWith(
      fetch(modifiedUrl, {
        credentials: event.request.credentials,
      }).catch(async () => {
        const cache = await caches.open(STATIC_CACHE)
        const cached = await cache.match('/') || await cache.match(modifiedUrl)
        return cached || new Response('MotoTrack — Brez povezave', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
      })
    )
    return
  }

  // Default: network with XTP, no caching
  const modifiedUrl = addXTP(url)
  event.respondWith(
    fetch(modifiedUrl, {
      method: event.request.method,
      headers: event.request.headers,
      body: event.request.body,
      mode: event.request.mode,
      credentials: event.request.credentials,
      redirect: event.request.redirect,
    })
  )
})

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data?.type === 'GET_CACHE_STATUS') {
    Promise.all([
      caches.open(STATIC_CACHE).then(c => c.keys()).then(k => k.length),
      caches.open(API_CACHE).then(c => c.keys()).then(k => k.length),
      caches.open(TILE_CACHE).then(c => c.keys()).then(k => k.length),
    ]).then(([staticCount, apiCount, tileCount]) => {
      event.ports[0]?.postMessage({
        type: 'CACHE_STATUS',
        static: staticCount,
        api: apiCount,
        tiles: tileCount,
        total: staticCount + apiCount + tileCount,
      })
    })
  }

  if (event.data?.type === 'CLEAR_TILE_CACHE') {
    caches.delete(TILE_CACHE)
  }

  if (event.data?.type === 'CLEAR_ALL_CACHES') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
  }
})
