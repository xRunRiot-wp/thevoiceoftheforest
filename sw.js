// The app's helper: always fetches the newest site first, and keeps a copy so the app still opens without signal.
// The shared table itself (Firebase) is never touched here.
const CACHE = 'votf-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r).then((hit) => hit || (r.mode === 'navigate' ? caches.match('./') : Response.error()))));
});
