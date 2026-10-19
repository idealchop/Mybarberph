/* Barbers.ph service worker. Kept small and safe:
 * - Never touches /api, /__/auth, Firebase or any cross-origin request (no caching of API or auth responses).
 * - Navigations: network first; the last good copy is only used when offline.
 * - Hashed build assets (/_next/static) and app icons: cache first (immutable).
 * - A new version waits until the page asks it to take over ("SKIP_WAITING" from the Update button). */
const VERSION = new URL(self.location.href).searchParams.get("v") || "0";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

self.addEventListener("install", () => {});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== PAGES && key !== ASSETS) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("message", (event) => { if (event.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__/") || url.pathname.endsWith(".webmanifest") || url.pathname === "/sw.js") return;

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") (await caches.open(PAGES)).put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await caches.match(req);
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa/")) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(ASSETS)).put(req, res.clone());
      return res;
    })());
  }
});
