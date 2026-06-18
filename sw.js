// ══════════════════════════════════════════════════
// LCampoR — Service Worker
// Estrategia:
//   • Cache-First para el shell de la app (HTML, manifest, iconos)
//   • Network-Only para Supabase y fuentes externas
// ══════════════════════════════════════════════════

const CACHE_VERSION = 'lcampor-4.5.1';
const SHELL_URLS = [
  './index.html',
  './manifest.json',
  './icons/icon-any-192.png',
  './icons/icon-any-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// ── INSTALL: cachear el shell completo ───────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar cachés anteriores ─────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // 1. Supabase, Google Fonts y otras APIs externas → siempre red
  if (
    url.includes('supabase.co') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('api.')
  ) {
    return; // dejar pasar sin interceptar (red directa)
  }

  // 2. Peticiones con cache-busting (actualización de versión) → siempre red
  if (url.includes('nocache=') || url.includes('_v=')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Si la respuesta es válida, actualizar el caché del shell
          if (res.ok) {
            const url2 = new URL(e.request.url);
            url2.search = '';
            const cleanReq = new Request(url2.toString());
            caches.open(CACHE_VERSION).then(c => c.put(cleanReq, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 3. Shell de la app → Cache-First con revalidación en background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res.ok) {
          caches.open(CACHE_VERSION).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => null);

      // Devolver caché inmediatamente si existe; si no, esperar la red
      return cached || networkFetch || caches.match('./index.html');
    })
  );
});

// ── MESSAGE: forzar activación inmediata ─────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
