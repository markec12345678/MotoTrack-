const CACHE_NAME = 'mototrack-v3';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Queue for failed POST requests during offline
let syncQueue: Array<{ url: string; method: string; body: string; headers: Record<string, string> }> = [];

// Load persisted queue from IndexedDB
async function loadQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction('sync-queue', 'readonly');
    const store = tx.objectStore('sync-queue');
    const items = await store.getAll();
    syncQueue = items || [];
  } catch { /* IndexedDB not available in SW context */ }
}

// Persist queue to IndexedDB
async function saveQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction('sync-queue', 'readwrite');
    const store = tx.objectStore('sync-queue');
    await store.clear();
    for (const item of syncQueue) {
      await store.add(item);
    }
  } catch { /* IndexedDB not available */ }
}

// Open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mototrack-sw-db', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Process queued requests
async function processQueue() {
  if (syncQueue.length === 0) return;

  const failed: typeof syncQueue = [];

  for (const item of syncQueue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (!response.ok) {
        failed.push(item);
      }
    } catch {
      failed.push(item);
    }
  }

  syncQueue = failed;
  await saveQueue();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => loadQueue())
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Queue POST/PUT/DELETE requests when offline
  if (request.method !== 'GET') {
    if (!navigator.onLine) {
      event.respondWith(
        request.text().then(async (body) => {
          syncQueue.push({
            url: request.url,
            method: request.method,
            body,
            headers: Object.fromEntries(request.headers.entries()),
          });
          await saveQueue();

          // Register background sync if available
          if ('sync' in self.registration) {
            self.registration.sync.register('mototrack-sync');
          }

          return new Response(JSON.stringify({ queued: true, queueLength: syncQueue.length }), {
            headers: { 'Content-Type': 'application/json' },
            status: 202,
          });
        })
      );
      return;
    }
    return;
  }

  // Skip Chrome extension requests and external resources
  if (
    request.url.startsWith('chrome-extension') ||
    request.url.includes('open-meteo.com') ||
    request.url.includes('api.dicebear.com')
  ) return;

  // For API GET requests, network first with cache fallback
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('[]', { status: 503 })))
    );
    return;
  }

  // For navigation requests (HTML pages), always try network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For static assets, cache first then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      });
    })
  );
});

// Background Sync - process queued requests when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'mototrack-sync') {
    event.waitUntil(processQueue());
  }
});

// Periodic Background Sync - refresh cached data periodically
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'mototrack-periodic') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        // Refresh key pages
        return cache.addAll(['/']);
      })
    );
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'MotoTrack';
  const options = {
    body: data.body || 'Novo obvestilo',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data || '/')
  );
});
