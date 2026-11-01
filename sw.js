/* Service Worker：讓網站可離線使用
   - 頁面（HTML）：網路優先，連不上時改用快取（所以更新部署後，有網路就會拿到新版）
   - CDN 資源（Tailwind、Font Awesome、Google Fonts）：先用快取，背景更新
   - AI 分析 API（/api/）：永遠不快取、直接走網路
   更新網站內容後，若要強制所有使用者重新抓取資源，把 CACHE_VERSION 加 1。 */
const CACHE_VERSION = 'health-guide-v1';
const CACHE_NAME = CACHE_VERSION;

const PRECACHE_LOCAL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const PRECACHE_CDN = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap'
];
const CACHEABLE_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 單一資源失敗不應讓整個安裝失敗
    await Promise.allSettled(PRECACHE_LOCAL.map(u => cache.add(new Request(u, { cache: 'reload' }))));
    await Promise.allSettled(PRECACHE_CDN.map(async u => {
      const res = await fetch(new Request(u, { mode: 'no-cors' }));
      await cache.put(u, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isApi(url) { return url.pathname.includes('/api/'); }

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);   // 網路很慢時也快速改用快取
    const res = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (res && res.ok) {
      cache.put(request, res.clone());
      cache.put('./index.html', res.clone());
    }
    return res;
  } catch (e) {
    return (await cache.match(request, { ignoreSearch: true })) ||
           (await cache.match('./index.html')) ||
           (await cache.match('./')) ||
           new Response('目前離線，且尚未儲存離線版本。請連上網路後開啟一次本網站。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isApi(url)) return;                                    // AI 分析：永遠走網路
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin || CACHEABLE_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
