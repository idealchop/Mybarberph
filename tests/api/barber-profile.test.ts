import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// Barber link Performance/profile (v1.0.22): token-checked, own share + tips only, rank as a position, no other barber's amounts.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
const { GET } = await import("@/app/api/barber/[token]/profile/route");

const TOKEN = "profiletok1";
const chairs = [
  { id: "c1", label: "Keith", barberId: "b-keith", barberName: "Keith", number: 1, sharePct: 45, shareSet: true },
  { id: "c2", label: "Jun", barberId: "b-jun", barberName: "Jun", number: 2, sharePct: 50, shareSet: true },
];
const now = Date.now();
const cut = (id: string, barberId: string, price: number, extra: Record<string, unknown> = {}) =>
  ({ id, ref: `W-${id}`, shopId: "shop-a", status: "done", channel: "walk-in", createdAt: now - 7200_000, updatedAt: now - 3600_000, completedAt: now - 3600_000, price, serviceName: "Haircut", paid: true, payMethod: "cash", barberId, ...extra });

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  Object.assign(fs.store, {
    [`chairLinks/${TOKEN}`]: { shopId: "shop-a", chairId: "c1" },
    "shops/shop-a": { name: "Shop A" },
    "shops/shop-a/private/chairs": { json: JSON.stringify(chairs) },
    "shops/shop-a/bookings/cut-k1": cut("cut-k1", "b-keith", 7500, { tip: 2000 }),
    "shops/shop-a/bookings/cut-k2": cut("cut-k2", "b-keith", 20000, { payMethod: "gcash" }),
    "shops/shop-a/bookings/cut-k3": cut("cut-k3", "b-keith", 10000),
    "shops/shop-a/bookings/cut-j1": cut("cut-j1", "b-jun", 99900),
    "shops/shop-a/remitClaims/k1": { id: "k1", barberId: "b-keith", locationId: "home", bookingIds: ["cut-k3"], amount: 10000, ownerShare: 5500, claimedAt: now - 1800_000 },
  });
});
const get = (token = TOKEN, range = "7d") => GET(new Request(`http://local/api/barber/${token}/profile?range=${range}`), { params: Promise.resolve({ token }) } as never);

describe("Barber link profile", () => {
  it("rejects an unknown or turned-off token", async () => {
    expect((await get("nope-token")).status).toBe(404);
  });
  it("returns the barber's own share per visit, tips separate (45% of ₱75 = ₱33.75), tips 100% to the barber", async () => {
    const d = await (await get()).json();
    expect(d.cuts).toBe(3);
    expect(d.sharePct).toBe(45);
    // 3375 + 9000 + 4500 share, + 2000 tip
    expect(d.share).toBe(16875);
    expect(d.tips).toBe(2000);
    expect(d.earnings).toBe(16875);
    expect(d.byDate.reduce((s: number, x: { earnings: number }) => s + x.earnings, 0)).toBe(16875);
    expect(d.byHour.reduce((s: number, x: { earnings: number }) => s + x.earnings, 0)).toBe(16875);
    // Unclaimed cash owner share: ₱75 cash -> 4125; ₱100 is claimed; GCash isn't handed over.
    expect(d.toClaim).toBe(4125);
    expect(d.claimed).toBe(5500);
  });
  it("shows rank as a position only, never other barbers' amounts or names", async () => {
    const r = await get(); const txt = await r.clone().text(); const d = await r.json();
    expect(d.rank).toBe(2); expect(d.of).toBe(2);
    expect(txt).not.toContain("99900"); expect(txt).not.toContain("b-jun"); expect(txt).not.toContain("Jun"); expect(txt).not.toContain("cut-j1");
  });
  it("rows for the shared Performance sections: own visits only, price = share, tip separate, no contact", async () => {
    fs.store["shops/shop-a/bookings/cut-k1"] = { ...(fs.store["shops/shop-a/bookings/cut-k1"] as object), contact: "09171234567", rating: 5 };
    const r = await get(); const txt = await r.clone().text(); const d = await r.json();
    expect(d.rows.map((x: { id: string }) => x.id).sort()).toEqual(["cut-k1", "cut-k2", "cut-k3"]);
    const k1 = d.rows.find((x: { id: string }) => x.id === "cut-k1");
    expect(k1.price).toBe(3375); expect(k1.tip).toBe(2000); expect(k1.rating).toBe(5);
    expect(txt).not.toContain("09171234567");
  });
  it("accepts today / all time and falls back to 7d for anything else", async () => {
    expect((await (await get(TOKEN, "all")).json()).range).toBe("all");
    expect((await (await get(TOKEN, "today")).json()).range).toBe("today");
    expect((await (await get(TOKEN, "bogus")).json()).range).toBe("7d");
  });
});
