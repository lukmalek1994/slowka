var CACHE = 'slowka-v16';
var FILES = ['./', 'index.html', 'style.css', 'app.js', 'extra.js','manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png','data/es-1.js', 'data/es-2.js', 'data/es-3.js', 'data/it-1.js', 'data/it-2.js', 'data/tr-es-1.js', 'data/tr-es-2.js', 'data/tr-es-3.js', 'data/tr-it-1.js', 'data/tr-it-2.js', 'data/tr-en-1.js', 'data/en-1.js', 'data/ph-es.js', 'data/ph-it.js', 'data/ph-en.js', 'data/ph-es-2.js', 'data/ph-it-2.js', 'data/ph-en-2.js', 'data/ph-es-3.js', 'data/ph-it-3.js', 'data/ph-en-3.js', 'data/rd-es-a.js', 'data/rd-es-b.js', 'data/rd-it-a.js', 'data/rd-it-b.js', 'data/rd-en-a.js', 'data/rd-en-b.js'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(FILES.map(function (f) { return c.add(f).catch(function () {}); })); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(function (r) {
    var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r;
  }).catch(function () { return caches.match(e.request); }));
});
