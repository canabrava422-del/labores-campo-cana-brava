// ══════════════════════════════════════════════════
// LCampoR — Service Worker v4.6.3
// ══════════════════════════════════════════════════

const CACHE = 'lcampor-4.6.6';
const BASE = '/labores-campo-cana-brava';
const SHELL = [
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icons/icon-any-192.png',
  BASE + '/icons/icon-any-512.png',
  BASE + '/icons/icon-maskable-192.png',
  BASE + '/icons/icon-maskable-512.png',
];

// ── INSTALL ──────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // 1. Recursos externos → red directa sin interceptar
  if (
    url.includes('supabase.co') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('cdnjs.cloudflare.com')
  ) return;

  // 2. Peticiones con cache-busting (_v= o nocache=) → SIEMPRE red
  //    Esto permite que checkServerVersion() y doUpdate() siempre
  //    vean la versión real del servidor, no la del caché del SW.
  if (url.includes('_v=') || url.includes('nocache=')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(BASE + '/index.html'))
    );
    return;
  }

  // 3. Todo lo demás → Stale-While-Revalidate
  //    Sirve desde caché inmediatamente, actualiza en background
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        return cached || networkFetch;
      })
    )
  );
});

// ── MESSAGE ──────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
