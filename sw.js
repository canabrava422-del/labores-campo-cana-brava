// ══════════════════════════════════════════════════
// LCampoR — Service Worker v4.6.0
// Estrategia Stale-While-Revalidate para index.html:
//   • Sirve desde caché inmediatamente (el SW controla
//     la página → Chrome habilita instalación PWA)
//   • Actualiza el caché en segundo plano silenciosamente
//   • NetworkOnly para Supabase y fuentes externas
// ══════════════════════════════════════════════════

const CACHE = 'lcampor-4.6.1';
const SHELL = [
  './index.html',
  './manifest.json',
  './icons/icon-any-192.png',
  './icons/icon-any-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
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
      .then(() => self.clients.claim()) // tomar control de páginas abiertas
  );
});

// ── FETCH ─────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Recursos externos → red directa sin interceptar
  if (
    url.includes('supabase.co') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('cdnjs.cloudflare.com')
  ) return;

  // Peticiones de actualización forzada → red, actualizar caché
  if (url.includes('nocache=')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clean = new Request(url.split('?')[0]);
            caches.open(CACHE).then(c => c.put(clean, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Todo lo demás → Stale-While-Revalidate
  // 1. Responde desde caché inmediatamente
  // 2. Actualiza caché en segundo plano
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
