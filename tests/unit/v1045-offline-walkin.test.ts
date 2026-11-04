import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { warmPages } from "@/lib/sw-warm";

// v1.0.45: offline, "Walk-in" (/queue/new) and "Start the haircut" opened "You're offline · This page wasn't saved".
describe("Walk-in and Start the haircut work offline", () => {
  it("/queue/new is kept for offline from any owner page", () => {
    for (const p of ["/home", "/queue", "/sales/profit"]) expect(warmPages(p)).toEqual(expect.arrayContaining(["/queue/new", "/queue", "/home"]));
    expect(warmPages("/b/tok")).toEqual(["/b/tok"]); // barber links unchanged
  });
  it("the service worker precaches /queue and /queue/new at install (new cache generation)", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).toMatch(/const SHELL = \[[^\]]*"\/queue\/new"/);
    expect(sw).toMatch(/const SHELL = \[[^\]]*"\/queue"/);
    expect(sw).toContain('const GEN = "v45"');
  });
  it("after Start the haircut the owner goes to /home (cached), not / (a redirect)", () => {
    const s = readFileSync("src/features/walkin/walk-in-screen.tsx", "utf8");
    expect(s).toContain('router.push(fromHome ? "/home" : "/queue")');
    expect(s).not.toContain('router.push(fromHome ? "/" :');
  });
  it("offline page buttons share one valid button style", () => {
    const h = readFileSync("public/offline.html", "utf8");
    expect(h).not.toMatch(/font:\s*700 15px\/48px inherit/);
    expect(h).toContain('class="btn btn-primary"');
    expect(h).toContain('<a class="btn btn-secondary" href="/home">Go to Home</a>');
  });
});

describe("saved pages keep their JS/CSS", () => {
  it("precaching a page also stores the /_next/static chunks its HTML lists (a page without them opened blank offline)", async () => {
    const sw = readFileSync("public/sw.js", "utf8");
    const src = sw.slice(sw.indexOf("function pageChunks"), sw.indexOf("async function precache"));
    const self = { location: { origin: "https://x.app" } };
    const pageChunks = new Function("self", `${src}; return pageChunks;`)(self) as (h: string) => string[];
    const html = `<script src="/_next/static/chunks/a-1.js" async></script><link rel="stylesheet" href="/_next/static/css/b.css"/>"/_next/static/chunks/c.js"`;
    expect(pageChunks(html)).toEqual(["https://x.app/_next/static/chunks/a-1.js", "https://x.app/_next/static/css/b.css", "https://x.app/_next/static/chunks/c.js"]);
    expect(sw).toContain("for (const x of pageChunks(await r.clone().text())) chunks.add(x)");
  });
});
