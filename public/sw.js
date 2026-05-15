// MotoTrack Service Worker - Adds XTransformPort to all requests
const XTP = '3002';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only intercept requests to the same origin
  if (url.origin !== self.location.origin) return;
  
  // Add XTransformPort if not already present
  if (!url.searchParams.has('XTransformPort')) {
    url.searchParams.set('XTransformPort', XTP);
    const newRequest = new Request(url.toString(), {
      method: event.request.method,
      headers: event.request.headers,
      body: event.request.body,
      mode: event.request.mode,
      credentials: event.request.credentials,
      redirect: event.request.redirect,
    });
    event.respondWith(fetch(newRequest));
  }
});
