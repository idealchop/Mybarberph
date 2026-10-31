/* Barbers.ph service worker (v1.0.39: offline-first PWA).
 * - Never touches /api, /__/auth, Firebase or any cross-origin request except images (no caching of API or auth).
 * - Navigations: network first (3.5 s), then the last good copy of that page, then /offline.html. Never rejects.
 * - Next.js RSC / prefetch requests (?_rsc= or RSC header): network first, then the cached payload for that page;
 *   on a miss a non-RSC 503 makes the router fall back to a full page load (which then gets the cached page).
 * - Build assets, fonts, icons and images: stale-while-revalidate; a missing image gets a blank image, never "?".
 * - Install precaches the app shell, the offline page and every icon/image (public/sw-precache.json).
 * - Old caches are deleted on activate (cache names carry GEN and the build). */
const GEN = "v39";
const VERSION = new URL(self.location.href).searchParams.get("v") || "0";
const PAGES = `bp-pages-${GEN}-${VERSION}`;
const ASSETS = `bp-assets-${GEN}-${VERSION}`;
const OFFLINE = "/offline.html";
const SHELL = ["/home", OFFLINE, "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];
const BLANK_IMG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

const skip = (url) => url.pathname.startsWith("/api/") || url.pathname.startsWith("/__/") || url.pathname === "/sw.js";
const isRsc = (req, url) => url.searchParams.has("_rsc") || req.headers.get("RSC") === "1" || req.headers.get("rsc") === "1";
/** One cache entry per page (RSC payload): ?_rsc= changes every time; full and prefetch payloads are kept apart. */
function rscKey(req, url) {
  const k = new URL(url.pathname, url.origin);
  for (const [n, v] of url.searchParams) if (n !== "_rsc") k.searchParams.set(n, v);
  k.searchParams.set("__bp_rsc", req.headers.get("Next-Router-Prefetch") === "1" ? "prefetch" : "full");
  return k.href;
}
const pageKey = (url) => new URL(url.pathname, url.origin).href;

/** Safari refuses a redirected response for a navigation, so a followed redirect is stored as a plain copy. */
async function plain(res) {
  if (!res || !res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}
async function put(cacheName, key, res) {
  try { if (res && (res.ok || res.type === "opaque")) await (await caches.open(cacheName)).put(key, await plain(res)); } catch { /* quota or opaque refused */ }
}
async function match(key) { try { return (await caches.match(key, { ignoreVary: true })) || null; } catch { return null; } }
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }
async function offlinePage() {
  return (await match(OFFLINE)) || new Response("<!doctype html><meta name=viewport content='width=device-width'><title>Offline</title><body style='font-family:system-ui;padding:40px 20px'><h1>You're offline</h1><p>Open the app again when you have internet.</p><button onclick='location.reload()'>Try again</button>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function navigate(req, url) {
  try {
    const res = await Promise.race([fetch(req), timeout(3500)]);
    if (res.ok && (res.type === "basic" || res.type === "default") && !res.redirected) await put(PAGES, pageKey(url), res.clone());
    if (res.ok || res.status < 500) return res;
    throw new Error(`HTTP ${res.status}`);
  } catch {
    if (url.pathname === "/") return Response.redirect(new URL("/home", url.origin).href, 302);
    return (await match(pageKey(url))) || (await offlinePage());
  }
}

async function rsc(req, url) {
  const key = rscKey(req, url);
  try {
    const res = await Promise.race([fetch(req), timeout(3500)]);
    if (res.ok) await put(PAGES, key, res.clone());
    return res;
  } catch {
    const hit = await match(key) || (key.endsWith("prefetch") ? await match(key.replace(/prefetch$/, "full")) : null);
    return hit || new Response("offline", { status: 503, headers: { "content-type": "text/plain" } });
  }
}

async function asset(event, req, url) {
  const key = url.origin === self.location.origin ? url.href : req;
  const hit = await match(key);
  const net = fetch(req).then(async (res) => { await put(ASSETS, key, res.clone()); return res; });
  if (hit) { event.waitUntil(net.catch(() => undefined)); return hit; }
  try { return await net; } catch {
    if (req.destination === "image" || /\.(png|jpe?g|webp|svg|gif|ico|avif)$/i.test(url.pathname) || url.pathname.startsWith("/_next/image"))
      return new Response(BLANK_IMG, { headers: { "content-type": "image/svg+xml" } });
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

async function precache(list, cacheName) {
  const c = await caches.open(cacheName);
  await Promise.all(list.map(async (u) => { try { const r = await fetch(u, { cache: "reload" }); if (r.ok) await c.put(new URL(u, self.location.origin).href, await plain(r)); } catch { /* next time */ } }));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await precache(SHELL.filter((u) => u !== "/manifest.webmanifest"), PAGES).catch(() => undefined);
    try { const d = await (await fetch("/sw-precache.json", { cache: "no-store" })).json(); await precache(d.assets || [], ASSETS); } catch { /* listed again on the next install */ }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== PAGES && key !== ASSETS) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("message", (event) => {
  const d = event.data;
  if (d === "SKIP_WAITING") { self.skipWaiting(); return; }
  // The page warms the cache: pages it may open offline, and the JS/CSS/images it already loaded.
  if (d && d.type === "warm") {
    const same = (u) => { try { const x = new URL(u, self.location.origin); return x.origin === self.location.origin && !skip(x) ? x : null; } catch { return null; } };
    const pages = (d.pages || []).map(same).filter(Boolean).map((x) => pageKey(x));
    const assets = (d.assets || []).map(same).filter(Boolean).map((x) => x.href);
    event.waitUntil((async () => {
      const have = async (k) => Boolean(await match(k));
      const p = []; for (const k of pages) if (!(await have(k))) p.push(k);
      const a = []; for (const k of assets) if (!(await have(k))) a.push(k);
      await precache(p, PAGES); await precache(a, ASSETS);
    })().catch(() => undefined));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) {
    // Shop logos and photos (Firebase Storage etc.): images only, so they show offline.
    if (req.destination === "image" && (url.protocol === "https:")) event.respondWith(asset(event, req, url));
    return;
  }
  if (skip(url)) return;
  if (req.mode === "navigate") { event.respondWith(navigate(req, url)); return; }
  if (isRsc(req, url)) { event.respondWith(rsc(req, url)); return; }
  event.respondWith(asset(event, req, url));
});
