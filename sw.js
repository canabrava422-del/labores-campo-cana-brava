// ══════════════════════════════════════════════════
// LCampoR — Service Worker v4.5.7
// Estrategia:
//   • NetworkFirst para index.html (siempre intenta red primero,
//     cae a caché si no hay conexión) — esto garantiza que iOS
//     siempre cargue la versión más nueva cuando hay red.
//   • CacheFirst para manifest e iconos (cambian raramente)
//   • NetworkOnly para Supabase y fuentes externas
// ══════════════════════════════════════════════════

const CACHE_VERSION = 'lcampor-4.5.9';
const SHELL_URLS = [
  './index.html',
  './manifest.json',
  './icons/icon-any-192.png',
  './icons/icon-any-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// ── INSTALL: pre-cachear shell ───────────────────
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

  // Supabase, fuentes y recursos externos → siempre red directa
  if (
    url.includes('supabase.co') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('cdnjs.cloudflare.com')
  ) {
    return; // sin interceptar
  }

  // index.html → Network First: intenta red, cae a caché si offline
  // Esto garantiza que siempre se cargue la versión más nueva cuando hay red
  if (
    url.includes('index.html') ||
    url.endsWith('/') ||
    url.split('?')[0].endsWith('/')
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          if (res.ok) {
            // Guardar el HTML fresco en caché para uso offline
            const toCache = new Request(url.split('?')[0].replace(/\/$/, '/index.html') ||
              url.split('?')[0]);
            caches.open(CACHE_VERSION).then(c => c.put(toCache, res.clone()));
          }
          return res;
        })
        .catch(() =>
          // Sin red: servir desde caché
          caches.match('./index.html')
        )
    );
    return;
  }

  // Manifest e iconos → Cache First (cambian solo con nueva versión del SW)
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE_VERSION).then(c => c.put(e.request, res.clone()));
          return res;
        })
      )
  );
});

// ── MESSAGE ──────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
