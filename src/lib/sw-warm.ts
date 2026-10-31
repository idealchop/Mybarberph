"use client";
/**
 * v1.0.39: tells the service worker which pages and files to keep for offline use: the page on screen, the owner's
 * main pages (so they open offline even if not visited yet), and every same-origin JS/CSS/font/image already loaded.
 */
export const OWNER_PAGES = ["/home", "/queue", "/sales", "/sales/profit", "/sales/barbers", "/history", "/settings", "/settings/shops", "/settings/services", "/moments"];

export function warmPages(path: string): string[] {
  const clean = path.split("?")[0]!.split("#")[0]!;
  if (clean.startsWith("/b/")) return [clean];
  if (clean.startsWith("/book") || clean.startsWith("/privacy") || clean.startsWith("/terms")) return [clean];
  return [...new Set([clean, ...OWNER_PAGES])];
}

export function warmAssets(entries: { name: string }[], origin: string): string[] {
  const out = new Set<string>();
  for (const e of entries) {
    try {
      const u = new URL(e.name, origin);
      if (u.origin !== origin || u.pathname.startsWith("/api/") || u.searchParams.has("_rsc")) continue;
      if (u.pathname.startsWith("/_next/") || /\.(js|css|png|jpe?g|webp|svg|gif|ico|avif|woff2?|ttf)$/i.test(u.pathname)) out.add(u.href);
    } catch { /* skip */ }
  }
  return [...out];
}

export function warmCache(path: string) {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller || navigator.onLine === false) return;
  const entries = typeof performance !== "undefined" ? (performance.getEntriesByType("resource") as PerformanceEntry[]) : [];
  navigator.serviceWorker.controller.postMessage({ type: "warm", pages: warmPages(path), assets: warmAssets(entries, location.origin) });
}
