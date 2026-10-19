import { describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
const { barberPerformance } = await import("@/lib/server/barber-sales");

describe("Barber My sales: Collected split", () => {
  it("TC-PAY-HP-04 cash, GCash and online are split; a paid visit with no method counts as cash (remit too)", async () => {
    const now = Date.now();
    const v = (id: string, x: Record<string, unknown>) => ({ id, status: "done", channel: "walk-in", barberId: "b-keith", price: 100, paid: true, createdAt: now - 3600_000, completedAt: now - 1800_000, ...x });
    Object.assign(fs.store, {
      "shops/shop-a/private/chairs": { json: JSON.stringify([{ id: "c1", label: "Keith", barberId: "b-keith", number: 1 }]) },
      "shops/shop-a/bookings/a": v("a", { payMethod: "cash" }),
      "shops/shop-a/bookings/b": v("b", { payMethod: "gcash", price: 250 }),
      "shops/shop-a/bookings/c": v("c", { payMethod: "online", price: 300 }),
      "shops/shop-a/bookings/d": v("d", { price: 40 }),
      "shops/shop-a/bookings/e": v("e", { paid: false, price: 70 }),
      "shops/shop-a/bookings/f": v("f", { payMethod: "gcash", barberId: "b-jun" }),
    });
    const r = await barberPerformance("shop-a", { range: "week", barberId: "b-keith", chairId: "c1" });
    expect({ cash: r.cash, gcash: r.gcash, online: r.online, other: r.other, unpaid: r.unpaid }).toEqual({ cash: 140, gcash: 250, online: 300, other: 0, unpaid: 70 });
    expect(r.remit).toBe(140);
    expect(r.unclaimedCash).toBe(140);
    expect(r.sales).toBe(760);
  });
});
