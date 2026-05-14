// MotoTrack Service Worker v4 — Offline-First PWA
// Cache-first for static assets, network-first for API, background sync for mutations

const CACHE_VERSION = 'mototrack-v4';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;

// App shell resources — cached on install for full offline UI
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.svg',
];

// Static asset extensions — cache-first strategy
const STATIC_EXTENSIONS = [
  '.css', '.js', '.mjs', '.woff', '.woff2', '.ttf', '.otf',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.json', '.woff2',
];

// API paths that should return cached data when offline
const CACHEABLE_API_PATHS = [
  '/api/rides',
  '/api/routes',
  '/api/user',
  '/api/users',
  '/api/leaderboard',
  '/api/stats',
  '/api/balkan-roads',
  '/api/events',
  '/api/camps',
  '/api/sync-queue',
  '/api/achievements',
  '/api/challenges',
  '/api/settings',
  '/api/favorites',
  '/api/feed',
  '/api/pois',
  '/api/weather',
  '/api/fuel',
  '/api/fuel-prices',
];

// External domains to skip (never cache)
const SKIP_DOMAINS = [
  'open-meteo.com',
  'api.dicebear.com',
  'chrome-extension',
];

// Offline fallback responses per content type
const OFFLINE_FALLBACKS = {
  'application/json': JSON.stringify({ offline: true, error: 'Brez povezave — podatki niso na voljo', data: [] }),
  'text/html': '<!DOCTYPE html><html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MotoTrack — Brez povezave</title><style>body{font-family:system-ui;margin:0;padding:0;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}h1{font-size:1.5rem;color:#f97316}p{color:#a1a1aa;margin-top:0.5rem}</style></head><body><div><h1>🏍️ MotoTrack</h1><p>Brez internetne povezave</p><p style="font-size:0.85rem;color:#71717a">Priključite se na omrežje za najnovejše podatke</p></div></body></html>',
};

// ──────────────────────────────────────────────────────────────────
// IndexedDB helpers for persisting the sync queue across SW restarts
// ──────────────────────────────────────────────────────────────────

let syncQueue = [];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mototrack-sw-db', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('offline-data')) {
        db.createObjectStore('offline-data', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction('sync-queue', 'readonly');
    const store = tx.objectStore('sync-queue');
    const items = await new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
    syncQueue = items;
  } catch {
    syncQueue = [];
  }
}

async function saveQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction('sync-queue', 'readwrite');
    const store = tx.objectStore('sync-queue');
    await new Promise((res, rej) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        let pending = Promise.resolve();
        for (const item of syncQueue) {
          pending = pending.then(() => new Promise((r, rj) => {
            const addReq = store.add(item);
            addReq.onsuccess = () => r();
            addReq.onerror = () => rj(addReq.error);
          }));
        }
        pending.then(res).catch(rej);
      };
      clearReq.onerror = () => rej(clearReq.error);
    });
  } catch {
    // IndexedDB unavailable
  }
}

// Store offline data (e.g., ride drafts) in IndexedDB
async function storeOfflineData(key, data) {
  try {
    const db = await openDB();
    const tx = db.transaction('offline-data', 'readwrite');
    const store = tx.objectStore('offline-data');
    await new Promise((res, rej) => {
      const req = store.put({ key, data, timestamp: Date.now() });
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────────────────────────
// Process queued requests (background sync)
// ──────────────────────────────────────────────────────────────────

async function processQueue() {
  if (syncQueue.length === 0) return;

  const stillFailed = [];
  let completed = 0;

  for (const item of syncQueue) {
    try {
      const headers = { ...item.headers };
      // Ensure content-type for JSON bodies
      if (!headers['Content-Type'] && item.body) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(item.url, {
        method: item.method,
        headers,
        body: item.body || undefined,
      });

      if (response.ok) {
        completed++;
        // Notify clients about successful sync
        notifyClients({ type: 'SYNC_SUCCESS', url: item.url, method: item.method });
      } else {
        // Server error — retry later
        item.attempts = (item.attempts || 0) + 1;
        if (item.attempts < (item.maxAttempts || 3)) {
          stillFailed.push(item);
        } else {
          // Max attempts reached — give up
          notifyClients({ type: 'SYNC_FAILED', url: item.url, method: item.method, reason: 'max_attempts' });
        }
      }
    } catch {
      // Network error — still offline? Keep in queue
      item.attempts = (item.attempts || 0) + 1;
      if (item.attempts < (item.maxAttempts || 5)) {
        stillFailed.push(item);
      } else {
        notifyClients({ type: 'SYNC_FAILED', url: item.url, method: item.method, reason: 'network_error' });
      }
    }
  }

  syncQueue = stillFailed;
  await saveQueue();

  if (completed > 0) {
    notifyClients({ type: 'SYNC_PROGRESS', completed, remaining: syncQueue.length });
  }
}

// Notify all controlled clients
function notifyClients(message) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage(message));
  });
}

// ──────────────────────────────────────────────────────────────────
// Determine caching strategy based on request
// ──────────────────────────────────────────────────────────────────

function isStaticAsset(url) {
  const pathname = new URL(url).pathname;
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function isApiRequest(url) {
  const pathname = new URL(url).pathname;
  return pathname.startsWith('/api/');
}

function isCacheableApi(url) {
  const pathname = new URL(url).pathname;
  return CACHEABLE_API_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));
}

function shouldSkip(url) {
  return SKIP_DOMAINS.some((domain) => url.includes(domain));
}

// ──────────────────────────────────────────────────────────────────
// Service Worker Event Handlers
// ──────────────────────────────────────────────────────────────────

// INSTALL — cache app shell for offline UI
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => loadQueue())
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — clean up old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => loadQueue())
      .then(() => self.clients.claim())
  );
});

// FETCH — routing based on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET mutations for offline queuing
  if (request.method !== 'GET') {
    event.respondWith(handleMutation(request));
    return;
  }

  // Skip chrome extensions and external APIs
  if (shouldSkip(request.url)) return;

  // Navigation requests — network first, cache fallback (offline page)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // API GET requests — network first with cache fallback
  if (isApiRequest(request.url)) {
    event.respondWith(handleApiGet(request));
    return;
  }

  // Static assets — cache first, then network
  if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // Everything else — stale-while-revalidate
  event.respondWith(handleStaleWhileRevalidate(request));
});

// SYNC — background sync for queued requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'mototrack-sync') {
    event.waitUntil(processQueue());
  }
  // Periodic data refresh
  if (event.tag === 'mototrack-periodic') {
    event.waitUntil(refreshCachedData());
  }
});

// PERIODIC SYNC — refresh key cached data
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'mototrack-periodic') {
    event.waitUntil(refreshCachedData());
  }
});

// PUSH — notification handler
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'MotoTrack';
  const options = {
    body: data.body || 'Novo obvestilo',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: data.url || '/',
    tag: data.tag || 'mototrack-notification',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// NOTIFICATION CLICK
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data || '/')
  );
});

// MESSAGE — handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_QUEUE_STATUS') {
    event.source.postMessage({
      type: 'QUEUE_STATUS',
      queueLength: syncQueue.length,
    });
  }
  if (event.data?.type === 'TRIGGER_SYNC') {
    if ('sync' in self.registration) {
      self.registration.sync.register('mototrack-sync');
    } else {
      processQueue();
    }
  }
  if (event.data?.type === 'STORE_OFFLINE_DATA') {
    storeOfflineData(event.data.key, event.data.value);
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ──────────────────────────────────────────────────────────────────
// Strategy implementations
// ──────────────────────────────────────────────────────────────────

// Handle non-GET requests — queue when offline
async function handleMutation(request) {
  if (!navigator.onLine) {
    const body = await request.text();
    const item = {
      url: request.url,
      method: request.method,
      body,
      headers: Object.fromEntries(request.headers.entries()),
      attempts: 0,
      maxAttempts: 5,
      queuedAt: Date.now(),
    };

    syncQueue.push(item);
    await saveQueue();

    // Try background sync registration
    if ('sync' in self.registration) {
      self.registration.sync.register('mototrack-sync');
    }

    // Also store in offline-data for the UI to read
    if (request.url.includes('/api/rides') && request.method === 'POST') {
      try {
        const rideData = JSON.parse(body);
        await storeOfflineData(`draft-ride-${Date.now()}`, rideData);
      } catch { /* ignore */ }
    }

    return new Response(
      JSON.stringify({ queued: true, queueLength: syncQueue.length, message: 'Shranjeno v čakalno vrsto — sinhronizirano bo, ko bo povezava na voljo' }),
      { headers: { 'Content-Type': 'application/json' }, status: 202 }
    );
  }

  // Online — pass through, but also try to process any queued items
  processQueue(); // Fire and forget
  return fetch(request);
}

// Navigation requests — network first with app shell fallback
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try cached version first
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fall back to cached root (app shell)
    const shellCached = await caches.match('/');
    if (shellCached) return shellCached;
    // Return offline HTML
    return new Response(OFFLINE_FALLBACKS['text/html'], {
      headers: { 'Content-Type': 'text/html' },
      status: 503,
    });
  }
}

// API GET — network first with cached fallback
async function handleApiGet(request) {
  // For cacheable API routes, try network then fall back to cache
  if (isCacheableApi(request.url)) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(API_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      // Offline — try cache
      const cached = await caches.match(request);
      if (cached) {
        // Add offline header so the UI knows this is stale data
        const headers = new Headers(cached.headers);
        headers.set('X-Served-From', 'cache');
        headers.set('X-Cache-Age', Date.now().toString());
        return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
      }
      // No cache — return offline JSON fallback
      return new Response(OFFLINE_FALLBACKS['application/json'], {
        headers: { 'Content-Type': 'application/json', 'X-Served-From': 'offline' },
        status: 503,
      });
    }
  }

  // Non-cacheable API — just try network
  try {
    return await fetch(request);
  } catch {
    return new Response(OFFLINE_FALLBACKS['application/json'], {
      headers: { 'Content-Type': 'application/json' },
      status: 503,
    });
  }
}

// Static assets — cache first, then network
async function handleStaticAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Could not fetch and not in cache — return empty for images, etc.
    return new Response('', { status: 404 });
  }
}

// Stale-while-revalidate for other resources
async function handleStaleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// Refresh key cached data when periodic sync fires
async function refreshCachedData() {
  const cache = await caches.open(API_CACHE);
  const keys = await cache.keys();

  // Refresh the most important endpoints
  const importantPaths = ['/api/rides', '/api/routes', '/api/user', '/api/leaderboard'];

  for (const path of importantPaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        await cache.put(path, response);
      }
    } catch { /* ignore */ }
  }
}
