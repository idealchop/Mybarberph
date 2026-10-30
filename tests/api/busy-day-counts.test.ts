import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.24 (Boyet prod audit, Oct 21–25): the owner Home "Today" counted only the newest 300 live bookings, so on a
// 510/680-visit day it showed 300 while every barber link counted all of its own. Owner counts now come from the
// server whole-Manila-day window (sales-rows) merged with live copies, the same source as barber History.
const fs = fakeFirestore();
const verifyIdToken = vi.fn(async (t: string) => { if (t === "owner") return { uid: "shop-a" }; throw new Error("bad"); });
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({ verifyIdToken }) }));
const { GET: salesRows } = await import("@/app/api/shop/sales-rows/route");
const { barberDayCuts } = await import("@/lib/server/barber-sales");
const { mergeLiveRows } = await import("@/lib/cut-count");
const { todayFigures } = await import("@/lib/chair-bookings");
const { asOwnerSplit, asBarberSplit } = await import("@/lib/split-view");
const { splitIncome } = await import("@/lib/income-split");

const chairs = [
  { id: "c1", label: "Allan", barberId: "b-allan", barberName: "Allan Jumao-as", number: 1, locationId: "home", sharePct: 50, shareSet: true },
  { id: "c2", label: "Jery", barberId: "b-jery", barberName: "Jery", number: 2, locationId: "loc-niugan", sharePct: 45, shareSet: true },
  { id: "c3", label: "MJ", barberId: "b-mj", barberName: "MJ", number: 3, locationId: "loc-lakeside", sharePct: 40, shareSet: true },
];
const N = 420;
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const today = ymd(Date.now());
const start = Date.parse(`${today}T00:00:00+08:00`) + 60_000; // 00:01 Manila
const step = Math.max(1, Math.floor((Date.now() - start - 60_000) / N));
const rows = Array.from({ length: N }, (_, i) => {
  const c = chairs[i % 3]!; const t = start + i * step;
  // Allan's visits keep the old name on the record (as in prod); counting is by barberId, never by name.
  return { id: `wk-${String(i).padStart(4, "0")}`, ref: `W${i}`, shopId: "shop-a", status: "done", channel: "walk-in", createdAt: t - 30_000, updatedAt: t, startedAt: t - 20_000, completedAt: t,
    price: [7500, 10000, 15000][i % 3]!, tip: i % 10 === 0 ? 2000 : 0, paid: true, payMethod: i % 4 === 0 ? "gcash" : "cash", serviceName: "Haircut", barberId: c.barberId, barberName: c.barberId === "b-allan" ? "Allan Tamayo" : c.barberName, locationId: c.locationId };
});

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  fs.store["shops/shop-a"] = { name: "Shop A" };
  fs.store["shops/shop-a/private/chairs"] = { json: JSON.stringify(chairs) };
  for (const r of rows) fs.store[`shops/shop-a/bookings/${r.id}`] = r;
});

describe("A day with more than 300 bookings", () => {
  it("owner Home today = the whole Manila day, matching the sum of every barber's own count", async () => {
    // Live list: newest 300 by createdAt (what /api/shop sends the owner).
    const live = [...rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, 300) as never[];
    const res = await salesRows(new Request("http://local/api/shop/sales-rows?days=2", { headers: { authorization: "Bearer owner" } }));
    expect(res.status).toBe(200);
    const deep = (await res.json()).rows;
    expect(deep).toHaveLength(N);

    const before = todayFigures(asOwnerSplit(live, chairs as never)).cuts; // the v1.0.20–1.0.23 Home
    const after = todayFigures(asOwnerSplit(mergeLiveRows(deep, live), chairs as never)).cuts;
    expect(before).toBe(300);
    expect(after).toBe(N);

    let barberTotal = 0;
    for (const c of chairs) {
      const d = await barberDayCuts("shop-a", { date: today, barberId: c.barberId, locationId: c.locationId, chairId: c.id });
      const ownerSide = mergeLiveRows(deep, live).filter((r: { barberId: string; completedAt: number }) => r.barberId === c.barberId && ymd(r.completedAt) === today).length;
      expect(d.rows).toHaveLength(ownerSide);
      barberTotal += d.rows.length;
    }
    expect(barberTotal).toBe(after);
  });

  it("owner share + barber share = price on every visit; tips stay 100% with the barber", async () => {
    const owner = asOwnerSplit(rows as never, chairs as never);
    const barber = asBarberSplit(rows as never, chairs as never);
    const byId = new Map(barber.map((r) => [r.id, r]));
    for (const o of owner) {
      const raw = rows.find((r) => r.id === o.id)!; const b = byId.get(o.id)!;
      const pct = chairs.find((c) => c.barberId === raw.barberId)!.sharePct;
      // asBarberSplit folds the tip into the barber's part; the share itself is that minus the tip.
      const share = b.price - raw.tip;
      expect(share).toBe(splitIncome(raw.price, pct).barber);
      expect(o.price + share).toBe(raw.price);
    }
    const ownerSum = todayFigures(owner).sales;
    const barberSum = barber.reduce((s, r) => s + r.price, 0) - rows.reduce((s, r) => s + r.tip, 0);
    expect(ownerSum + barberSum).toBe(rows.reduce((s, r) => s + r.price, 0));
  });
  it("To Claim stays right past 500 claims: old claimed visits never reappear as unclaimed", async () => {
    const { remitSummary } = await import("@/lib/server/remit");
    // Separate shop id: remit keeps a 15 s per-shop cache, and the first test already loaded shop-a.
    fs.store["shops/shop-b/private/chairs"] = { json: JSON.stringify(chairs) };
    for (const r of rows) fs.store[`shops/shop-b/bookings/${r.id}`] = r;
    const cash = rows.filter((r) => r.payMethod === "cash");
    const claimed = cash.slice(5);
    claimed.forEach((r, i) => { fs.store[`shops/shop-b/remitClaims/k${i}`] = { id: `k${i}`, barberId: r.barberId, locationId: r.locationId, bookingIds: [r.id], amount: r.price, claimedAt: Date.now() - (claimed.length - i) * 1000 }; });
    expect(claimed.length).toBeGreaterThan(300);
    const sum = await remitSummary("shop-b", "all");
    // v1.0.25: GCash visits are claimable too, so everything not listed in a claim is still to claim.
    const listed = new Set(claimed.map((r) => r.id));
    const open = rows.filter((r) => r.paid && r.price > 0 && !listed.has(r.id));
    const owed = open.reduce((s, r) => s + (r.price - splitIncome(r.price, chairs.find((c) => c.barberId === r.barberId)!.sharePct).barber), 0);
    expect(sum.unclaimed.reduce((s: number, u: { ownerShare?: number }) => s + (u.ownerShare ?? 0), 0)).toBe(owed);
    expect(sum.claims.length).toBe(claimed.length);
  });
});
