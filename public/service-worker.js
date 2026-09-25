// Minimal service worker — just enough to satisfy "Add to Home Screen"
// installability criteria. Doesn't cache anything itself; every request
// still goes straight to the network, so the site always shows the
// latest data.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
