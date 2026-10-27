// 전투 순양함 서비스 워커 — 네트워크 우선(항상 최신 파일), 실패 시 캐시로 대체.
// 파일을 크게 바꿨는데 옛 화면이 보이면 아래 버전 숫자를 올리세요.
const CACHE = 'battlecruiser-v4';
const CORE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(CORE.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // 같은 사이트의 일반 GET 요청만 처리. 오디오의 부분 요청(Range)은 건드리지 않음.
  if (request.method !== 'GET' || url.origin !== location.origin || request.headers.has('range')) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request)
          .then(cached => cached || caches.match(request, { ignoreSearch: true }))
          .then(cached => cached || (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))
      )
  );
});
