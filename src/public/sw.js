// Libra-Local service worker — runtime cache-first for offline use.
// After the first online load, the app shell, assets, and PDF.js worker are
// served from cache, so the app works fully offline. Imported PDFs live in
// OPFS (not here). Bump CACHE to invalidate after a deploy.

const CACHE = "libra-local-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === "basic") {
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        // Offline and uncached: fall back to the app shell for navigations.
        if (req.mode === "navigate") {
          const shell = await cache.match(self.registration.scope);
          if (shell) return shell;
        }
        return Response.error();
      }
    })(),
  );
});
