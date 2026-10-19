import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// Real barber PUT route and real putBooking on an in-memory Firestore; only the activity log is stubbed.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("@/lib/server/activity", () => ({ bookingActivity: vi.fn(async () => undefined), stateActivity: vi.fn(async () => undefined), logActivity: vi.fn(async () => undefined), OWNER: { name: "Owner", role: "owner" } }));

const { PUT } = await import("@/app/api/barber/[token]/bookings/[id]/route");
const { putBooking } = await import("@/lib/server/shops");

const NOW = Date.now();
const menu = [
  { id: "haircut", name: "Haircut", durationMins: 30, price: 25_000, kind: "haircut" },
  { id: "beard", name: "Beard trim", durationMins: 15, price: 10_000, kind: "treatment" },
];
const chairs = [{ id: "c1", label: "Keith", barberId: "b-keith", barberName: "Keith", number: 1 }];
const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, ref: "A1", channel: "walk-in", status: "in_chair", serviceName: "Haircut", serviceId: "haircut", createdAt: NOW, ...extra });
const saved = (id: string) => fs.store[`shops/shop-a/bookings/${id}`] as Record<string, unknown>;

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  Object.assign(fs.store, {
    "chairLinks/keithtoken1": { shopId: "shop-a", chairId: "c1" },
    "shops/shop-a": { name: "Shop A", menu, plan: "pro" },
    "shops/shop-a/private/chairs": { json: JSON.stringify(chairs) },
  });
});

const put = (booking: Record<string, unknown>) =>
  PUT(new Request("http://local", { method: "PUT", body: JSON.stringify({ booking }) }), { params: Promise.resolve({ token: "keithtoken1", id: booking.id }) } as never);

describe("Barber link: amount is the menu price; tip is separate", () => {
  it("TC-BARBER-NEG-05 a barber can't save a Haircut (₱250) as ₱240: the server saves the menu price", async () => {
    const res = await put(row("v-w1", { price: 24_000 }));
    expect(res.status).toBe(200);
    expect(saved("v-w1").price).toBe(25_000);
  });

  it("TC-BARBER-HP-04 several services: the amount is the menu total, whatever the client sent", async () => {
    await put(row("v-w2", { serviceName: "Haircut · Beard trim", price: 1 }));
    expect(saved("v-w2").price).toBe(35_000);
  });

  it("TC-BARBER-ODD-02 a home visit keeps its fee on top of the menu price; a visit paid online keeps its paid amount", async () => {
    fs.store["shops/shop-a/bookings/home1"] = { ...row("home1"), barberId: "b-keith", price: 30_000, homeFee: 5_000, home: { address: "x", lat: 0, lng: 0, distanceKm: 2 } };
    await put(row("home1", { price: 1 }));
    expect(saved("home1").price).toBe(30_000);
    fs.store["shops/shop-a/bookings/paid1"] = { ...row("paid1", { channel: "online" }), barberId: "b-keith", price: 22_000, paid: true, payWhere: "online", payMethod: "online" };
    await put(row("paid1", { channel: "online", price: 1, paid: true, payWhere: "online", payMethod: "online" }));
    expect(saved("paid1").price).toBe(22_000);
  });

  it("TC-TIP-HP-01 a tip is saved as whole pesos in its own field and never changes the amount", async () => {
    fs.store["shops/shop-a/bookings/v-t1"] = { ...row("v-t1"), shopId: "shop-a", barberId: "b-keith", price: 25_000 };
    await put(row("v-t1", { status: "done", paid: true, payMethod: "cash", price: 25_000, tip: "50.9" }));
    expect(saved("v-t1")).toMatchObject({ price: 25_000, tip: 50, paid: true, payMethod: "cash" });
  });

  it("TC-TIP-NEG-01 a negative, zero or non-number tip is dropped", async () => {
    for (const [id, tip] of [["v-n1", -5], ["v-n2", 0], ["v-n3", "abc"]] as const) {
      await put(row(id, { tip }));
      expect(saved(id)).not.toHaveProperty("tip");
    }
  });

  it("TC-BARBER-HP-05 the owner can still set a custom amount (owner path, no barber)", async () => {
    await putBooking("shop-a", row("v-o1", { price: 24_000 }));
    expect(saved("v-o1").price).toBe(24_000);
  });
});
