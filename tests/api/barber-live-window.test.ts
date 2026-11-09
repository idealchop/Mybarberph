import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// A barber poll reads the open queue and today's cuts, not the barber's whole history.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("server-only", () => ({}));
const { GET } = await import("@/app/api/barber/[token]/route");

const TOKEN = "keithtoken1";
const chairs = [{ id: "c1", label: "Keith", barberId: "b-keith", barberName: "Keith", number: 1 }];
const oldAt = Date.parse("2026-07-01T02:00:00Z");

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  Object.assign(fs.store, {
    [`chairLinks/${TOKEN}`]: { shopId: "shop-a", chairId: "c1" },
    "shops/shop-a": { name: "Shop A", menu: [], queueRev: 3 },
    "shops/shop-a/private/chairs": { json: JSON.stringify(chairs) },
    "shops/shop-a/private/profile": { json: "{}" },
    "shops/shop-a/private/menu": { json: "{}" },
    "shops/shop-a/private/locations": { json: "{}" },
  });
  for (let i = 0; i < 40; i++) {
    fs.store[`shops/shop-a/bookings/old-${i}`] = { id: `old-${i}`, status: "done", barberId: "b-keith", createdAt: oldAt + i, updatedAt: oldAt + i, completedAt: oldAt + i, price: 100, locationId: "home" };
  }
  fs.store["shops/shop-a/bookings/waiting"] = { id: "waiting", status: "requested", channel: "online", createdAt: oldAt, updatedAt: oldAt, price: 100, locationId: "home" };
  fs.store["shops/shop-a/bookings/finished"] = { id: "finished", status: "done", barberId: "b-keith", createdAt: Date.now() - 60_000, updatedAt: Date.now(), completedAt: Date.now(), price: 100, locationId: "home" };
});

const open = (rev?: number) => GET(new Request(`http://local${rev ? `?rev=${rev}` : ""}`), { params: Promise.resolve({ token: TOKEN }) } as never);

describe("barber link live read", () => {
  it("returns the waiting visit and today's cut, not the old history", async () => {
    const res = await open();
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = (body.bookings as { id: string }[]).map((b) => b.id).sort();
    expect(ids).toEqual(["finished", "waiting"]);
    expect(body.rev).toBe(3);
  });

  it("answers unchanged, without the booking list, when the revision matches", async () => {
    const res = await open(3);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ unchanged: true, rev: 3 });
  });
});
