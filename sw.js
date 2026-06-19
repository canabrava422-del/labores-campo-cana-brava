// ══════════════════════════════════════════════════
// LCampoR — Service Worker v4.6.2
// ══════════════════════════════════════════════════

const CACHE = 'lcampor-4.6.2';
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

  // Recursos externos → red directa
  if (
    url.includes('supabase.co') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('cdnjs.cloudflare.com')
  ) return;

  // Stale-While-Revalidate para todo lo demás
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
