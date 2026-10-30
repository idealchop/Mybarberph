import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.24 guardrail: seeded property-style invariants, IN-MEMORY ONLY (fake Firestore, nothing is written to a real DB).
// For many random shops/days: owner total = Σ barber totals (+ owner's own + Unassigned), owner share + barber share =
// price per visit, the Home pipeline (whole-day read ∪ capped live list) never loses a visit, and nothing truncates.
const fs = fakeFirestore();
const verifyIdToken = vi.fn(async (t: string) => ({ uid: t }));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({ verifyIdToken }) }));
const { GET: salesRows } = await import("@/app/api/shop/sales-rows/route");
const { barberDayCuts } = await import("@/lib/server/barber-sales");
const { mergeLiveRows } = await import("@/lib/cut-count");
const { dayTotals, ownerDayTotal, visitSplit } = await import("@/lib/counts");
const { capHits } = await import("@/lib/server/capped-read");

function prng(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);

function scenario(seed: number, perDay: number) {
  const rnd = prng(seed), pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
  const locs = ["home", "loc-niugan", "loc-lakeside"];
  // Same person on several links (b-allan at home + niugan), different % per link, one barber with no split set.
  const chairs = [
    { id: "c1", label: "Allan", barberId: "b-allan", barberName: "Allan Jumao-as", locationId: "home", sharePct: 50, shareSet: true },
    { id: "c2", label: "Allan", barberId: "b-allan", barberName: "Allan Jumao-as", locationId: "loc-niugan", sharePct: 40, shareSet: true },
    { id: "c3", label: "Jery", barberId: "b-jery", barberName: "Jery", locationId: "loc-niugan", sharePct: 45, shareSet: true },
    { id: "c4", label: "MJ", barberId: "b-mj", barberName: "MJ", locationId: "loc-lakeside", sharePct: 33, shareSet: true },
    { id: "c5", label: "Nonoy", barberId: "b-nonoy", barberName: "Nonoy", locationId: "home" },
  ];
  const day = ymd(Date.now() - 86_400_000); // yesterday: a whole, finished Manila day
  const d0 = Date.parse(`${day}T00:00:00+08:00`);
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < perDay; i++) {
    const kind = rnd();
    const c = pick(chairs);
    const who = kind < 0.04 ? { barberId: "owner", barberName: "Owner", locationId: pick(locs) } : kind < 0.08 ? { locationId: pick(locs) } : { barberId: c.barberId, barberName: rnd() < 0.3 ? "Allan Tamayo (old name)" : c.barberName, locationId: c.locationId };
    const completedAt = i < 25 ? d0 + 60_000 * (i + 1) : d0 + Math.floor(rnd() * 86_399_000);
    const createdAt = i < 25 ? d0 - 30 * 60_000 : completedAt - Math.floor(rnd() * 3 * 3600_000); // first 25 cross midnight
    const status = rnd() < 0.05 ? pick(["cancelled", "no-show", "waiting"]) : "done";
    rows.push({ id: `${rnd() < 0.1 ? "qr" : "wk"}-${seed}-${i}`, ref: `R${i}`, status, channel: "walk-in", createdAt, updatedAt: completedAt, completedAt: status === "done" ? completedAt : undefined,
      price: pick([7500, 10000, 12000, 15000, 9999]), tip: rnd() < 0.15 ? 2000 : 0, paid: true, payMethod: "cash", serviceName: "Haircut",
      ...(rnd() < 0.5 ? { splitPct: pick([30, 50, 60]) } : {}), ...who });
  }
  // Something finishing today (outside the day) and something from 2 days ago, to catch off-by-a-day windows.
  rows.push({ id: `wk-${seed}-late`, status: "done", createdAt: d0 + 86_000_000, completedAt: d0 + 86_400_000 + 1000, price: 10000, barberId: "b-mj", locationId: "loc-lakeside" });
  return { chairs, rows, day };
}

function load(shop: string, s: ReturnType<typeof scenario>) {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  fs.store[`shops/${shop}`] = { name: shop };
  fs.store[`shops/${shop}/private/chairs`] = { json: JSON.stringify(s.chairs) };
  for (const r of s.rows) fs.store[`shops/${shop}/bookings/${r.id}`] = r;
}

describe("count invariants (seeded, in-memory)", () => {
  beforeEach(() => { capHits.length = 0; });
  for (const [seed, perDay] of [[1, 1200], [7, 1500], [42, 640], [99, 30]] as const) {
    it(`seed ${seed}: ${perDay} visits/day`, async () => {
      const shop = `inv-${seed}`; const s = scenario(seed, perDay); load(shop, s);
      const res = await salesRows(new Request("http://local/api/shop/sales-rows?days=3", { headers: { authorization: `Bearer ${shop}` } }));
      const body = await res.json();
      expect(body.truncated ?? false).toBe(false);
      const deep = body.rows;
      const expected = s.rows.filter((r) => r.status === "done" && ymd(r.completedAt as number) === s.day);
      // Home pipeline: whole-day read ∪ newest-300 live window never loses or doubles a visit.
      const live = [...s.rows].sort((a, b) => (b.createdAt as number) - (a.createdAt as number)).slice(0, 300);
      const owner = ownerDayTotal(mergeLiveRows(deep, live as never) as never, s.chairs, s.day);
      expect(owner.haircuts).toBe(expected.length);
      expect(owner.sales).toBe(expected.reduce((n, r) => n + (r.price as number), 0));
      // Per visit: owner share + barber share = price, shares never negative.
      for (const r of expected) { const v = visitSplit(r as never, s.chairs); expect(v.owner + v.barber).toBe(v.price); expect(v.barber).toBeGreaterThanOrEqual(0); expect(v.owner).toBeGreaterThanOrEqual(0); }
      // Owner total = Σ every barber link's own server day count (+ owner's own + Unassigned).
      const byKey = dayTotals(deep, s.chairs, s.day);
      let links = 0, linkBarber = 0;
      for (const c of s.chairs) {
        const d = await barberDayCuts(shop, { date: s.day, barberId: c.barberId, locationId: c.locationId, chairId: c.id });
        expect(d.rows.length).toBe(byKey.get(`${c.barberId}@${c.locationId}`)?.haircuts ?? 0);
        links += d.rows.length; linkBarber += d.rows.reduce((n, r) => n + visitSplit(r as never, s.chairs).barber, 0);
      }
      let rest = 0; for (const [k, v] of byKey) if (k.startsWith("owner@") || k.startsWith("unassigned@")) rest += v.haircuts;
      expect(links + rest).toBe(owner.haircuts);
      expect(linkBarber).toBe(owner.barber);
      expect(capHits.filter((h) => h.kind === "total")).toEqual([]);
    }, 30_000);
  }
});
