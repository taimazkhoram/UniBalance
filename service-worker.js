/* UniBalance service worker: offline app shell only. User data lives in LocalStorage and is never cached here.
   Strategy: network first (so updates arrive as soon as you are online), cached copy when offline. */
const CACHE = 'unibalance-shell-v2';
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/style.css',
  'js/date.js', 'js/storage.js', 'js/ui.js', 'js/tasks.js', 'js/university.js', 'js/finance.js',
  'js/home.js', 'js/calendar.js', 'js/notifications.js', 'js/settings.js', 'js/app.js',
  'assets/icons/icon-180.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('unibalance-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

// Tapping a notification brings the app to the front.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
