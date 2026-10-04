// 전국 해안 일주 서비스워커 (지리산 둘레길 앱과 같은 방식)
// 네트워크 우선: 온라인이면 최신, 오프라인이면 캐시. 데이터·셸을 고치면 아래 버전을 올린다.
const SHELL = 'coast-shell-v35';
const FILES = [
  './', './index.html', './app.css', './app.js', './manifest.webmanifest', './data/trip.json', './data/restaurants.json',
  './icons/icon-192.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
