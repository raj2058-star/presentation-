/* AppleLab service worker — offline cache for the web edition */
const CACHE = 'applelab-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css', './icons/icon.svg',
  './js/util.js', './js/instruments.js', './js/store.js', './js/engine.js', './js/ui.js', './js/timeline.js',
  './js/pianoroll.js', './js/drumeditor.js', './js/audioeditor.js', './js/mixer.js', './js/keyboard.js',
  './js/recorder.js', './js/app.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// network first, fall back to cache (so updates show up immediately when online)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request))
  );
});
