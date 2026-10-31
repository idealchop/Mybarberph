import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { _restart, _setDisk, cached, cachedAt, fetchShared, invalidate, newestAt, setSwrScope } from "@/lib/swr";
import { warmAssets, warmPages } from "@/lib/sw-warm";

function memDisk() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } };
}

describe("v1.0.39 saved owner data (swr on the phone)", () => {
  let d: ReturnType<typeof memDisk>;
  beforeEach(() => { d = memDisk(); _setDisk(d); setSwrScope(null); });

  it("a loaded value is there after an app restart, for the same owner only", async () => {
    setSwrScope("owner-a");
    await fetchShared("sales-rows:70:0", async () => [{ id: "v1" }]);
    setSwrScope("owner-b"); // another owner signs in: owner-a's copy is dropped
    expect(cached("sales-rows:70:0")).toBeUndefined();
    setSwrScope("owner-a");
    await fetchShared("remit:all", async () => ({ total: 5000 }));
    _restart(); setSwrScope("owner-a"); // memory gone (restart)
    expect(cached("remit:all")).toEqual({ total: 5000 });
    expect(cachedAt("remit:all")).toBeGreaterThan(0);
    expect(newestAt()).toBeGreaterThan(0);
  });

  it("offline: the request fails but the saved value stays", async () => {
    setSwrScope("owner-a");
    await fetchShared("remit:all", async () => ({ total: 1 }));
    await expect(fetchShared("remit:all", async () => { throw new TypeError("Load failed"); })).rejects.toThrow();
    expect(cached("remit:all")).toEqual({ total: 1 });
  });

  it("before the session starts, uses the last signed-in owner on this phone", async () => {
    setSwrScope("owner-a");
    await fetchShared("k", async () => 7);
    d.setItem("bp.lastUser", JSON.stringify({ uid: "owner-a" }));
    _restart(); // first paint after a restart: no session yet
    expect(cached("k")).toBe(7);
  });

  it("invalidate drops the saved copy too (after a claim)", async () => {
    setSwrScope("owner-a");
    await fetchShared("remit:all", async () => ({ total: 1 }));
    invalidate("remit:");
    _restart(); setSwrScope("owner-a");
    expect(cached("remit:all")).toBeUndefined();
  });
});

describe("v1.0.39 cache warm list", () => {
  it("owner pages plus the current one; barber link only itself", () => {
    expect(warmPages("/sales?view=barbers")).toEqual(expect.arrayContaining(["/sales", "/home", "/settings/shops", "/settings/services"]));
    expect(warmPages("/b/tok123")).toEqual(["/b/tok123"]);
  });
  it("only same-origin files, never /api or RSC", () => {
    const o = "https://x.app";
    expect(warmAssets([{ name: "https://x.app/_next/static/a.js" }, { name: "https://x.app/api/shop" }, { name: "https://cdn.y/a.png" }, { name: "https://x.app/icons3d/a.webp" }, { name: "https://x.app/home?_rsc=1" }], o))
      .toEqual(["https://x.app/_next/static/a.js", "https://x.app/icons3d/a.webp"]);
  });
});

/* ---- service worker in a fake worker scope ---- */
type Handler = (e: unknown) => void;
function loadSw(net: (url: string, init?: unknown) => Promise<Response>) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (k: unknown) => (typeof k === "string" ? k : (k as Request).url);
  const caches = {
    open: async (n: string) => {
      if (!stores.has(n)) stores.set(n, new Map());
      const m = stores.get(n)!;
      return { put: async (k: unknown, r: Response) => void m.set(keyOf(k), r.clone()), match: async (k: unknown) => m.get(keyOf(k))?.clone() };
    },
    match: async (k: unknown) => { for (const m of stores.values()) { const r = m.get(new URL(keyOf(k), "https://app.test").href) ?? m.get(keyOf(k)); if (r) return r.clone(); } return undefined; },
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
  };
  const self = { location: { href: "https://app.test/sw.js?v=b1", origin: "https://app.test" }, addEventListener: (t: string, h: Handler) => { handlers[t] = h; }, skipWaiting: async () => undefined, clients: { claim: async () => undefined } };
  const src = readFileSync("public/sw.js", "utf8");
  new Function("self", "caches", "fetch", src)(self, caches, net);
  const fire = async (url: string, o: { mode?: string; headers?: Record<string, string>; destination?: string } = {}) => {
    let p: Promise<Response> | null = null;
    const request = Object.assign(new Request(url, { headers: o.headers }), {});
    Object.defineProperty(request, "mode", { value: o.mode ?? "cors" });
    Object.defineProperty(request, "destination", { value: o.destination ?? "" });
    handlers.fetch!({ request, respondWith: (x: Promise<Response>) => { p = x; }, waitUntil: () => undefined });
    return p as Promise<Response> | null;
  };
  return { fire, caches, stores, handlers };
}
const html = (s: string) => new Response(s, { headers: { "content-type": "text/html" } });
const down = async () => { throw new TypeError("Load failed"); };

describe("v1.0.39 service worker offline", () => {
  it("navigation: network, then the saved page, then the offline page; never rejects", async () => {
    let online = true;
    const sw = loadSw(async (u) => { if (!online) throw new TypeError("Load failed"); return html(`page ${u}`); });
    expect(await (await sw.fire("https://app.test/sales", { mode: "navigate" }))!.text()).toContain("page");
    online = false;
    expect(await (await sw.fire("https://app.test/sales?x=1", { mode: "navigate" }))!.text()).toContain("page");
    const r = sw.fire("https://app.test/settings/never", { mode: "navigate" })!;
    await expect(r).resolves.toBeInstanceOf(Response);
    expect(await (await r)!.text()).toMatch(/offline/i);
  });

  it("RSC request: saved payload by page (ignores _rsc), else a non-RSC 503 (router falls back), never rejects", async () => {
    let online = true;
    const sw = loadSw(async () => { if (!online) throw new TypeError("Load failed"); return new Response("RSCDATA", { headers: { "content-type": "text/x-component" } }); });
    await sw.fire("https://app.test/sales?_rsc=abc", { headers: { RSC: "1" } });
    online = false;
    expect(await (await sw.fire("https://app.test/sales?_rsc=zzz", { headers: { RSC: "1" } }))!.text()).toBe("RSCDATA");
    const miss = await sw.fire("https://app.test/queue?_rsc=q", { headers: { RSC: "1" } });
    expect((await miss)!.status).toBe(503);
  });

  it("images: saved copy offline, a blank image when never saved (no broken icon)", async () => {
    let online = true;
    const sw = loadSw(async () => { if (!online) throw new TypeError("Load failed"); return new Response("IMG", { headers: { "content-type": "image/webp" } }); });
    await sw.fire("https://app.test/icons3d/a.webp", { destination: "image" });
    online = false;
    expect(await (await sw.fire("https://app.test/icons3d/a.webp", { destination: "image" }))!.text()).toBe("IMG");
    const blank = await (await sw.fire("https://app.test/icons3d/new.webp", { destination: "image" }))!;
    expect(blank.headers.get("content-type")).toBe("image/svg+xml");
  });

  it("never touches /api or non-image cross-origin requests", async () => {
    const sw = loadSw(down);
    expect(await sw.fire("https://app.test/api/shop")).toBeNull();
    expect(await sw.fire("https://other.test/x.js")).toBeNull();
  });
});
