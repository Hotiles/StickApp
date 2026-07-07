/*
 * Service worker för Stickan.
 * Strategi:
 *  - Navigeringar (index.html): network-first — färsk HTML när nät finns,
 *    cachen som offline-fallback. Så når nya byggen användarna direkt.
 *  - Övriga same-origin GET (hashade byggfiler, ikoner, manifest): cache-first.
 * Versionen stämplas vid bygget (se vite.config.js), så varje deploy blir en
 * ny service worker och gamla cachar rensas vid activate.
 */
const CACHE_VERSION = 'stickan-__BUILD_VERSION__';
const CORE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  // Inget skipWaiting här: den nya versionen väntar tills användaren väljer
  // "Uppdatera" i appens banner (eller alla flikar stängts).
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION && k !== 'stickan-shared').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Web Share Target: tar emot en delad PDF (POST), lägger den i en tillfällig
// cache och skickar användaren vidare till importvyn i appen.
async function handleShareTarget(event) {
  const formData = await event.request.formData();
  const file = formData.get('file');
  if (file && file.size > 0) {
    const cache = await caches.open('stickan-shared');
    await cache.put(
      'shared-pdf',
      new Response(file, {
        headers: {
          'Content-Type': file.type || 'application/pdf',
          'X-File-Name': encodeURIComponent(file.name || 'delat-monster.pdf'),
        },
      })
    );
  }
  return Response.redirect('./#/dela', 303);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(handleShareTarget(event));
    return;
  }

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
