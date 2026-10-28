// The app's helper: always fetches the newest site first, and keeps a copy so the app still opens without signal.
// It also shows the phone notifications sent by push/notify.mjs. The shared table itself (Firebase) is never touched here.
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
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'Voice of the Forest', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Voice of the Forest', {
    body: d.body || '', tag: d.tag, icon: d.icon || 'assets/ui/app_icon_192.png', badge: 'assets/ui/app_icon_192.png', data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const w = list.find((c) => c.url.startsWith(self.registration.scope));
    if (w) return w.focus().then((c) => c.navigate(url)).catch(() => self.clients.openWindow(url));
    return self.clients.openWindow(url);
  }));
});
