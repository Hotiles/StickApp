/*
 * Service worker för Stickan.
 * Strategi: cache-first med runtime-cachning av alla same-origin GET-svar.
 * Vid ny version: bumpa CACHE_VERSION så gamla cachar rensas vid activate.
 */
const CACHE_VERSION = 'stickan-v2';
const CORE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(handleShareTarget(event));
    return;
  }

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
