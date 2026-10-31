import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.38: an offline save is retried with the same phone-made id; the server keeps it as one record.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("@/lib/server/activity", () => ({ bookingActivity: vi.fn(async () => undefined), stateActivity: vi.fn(async () => undefined), logActivity: vi.fn(async () => undefined), OWNER: { name: "Owner", role: "owner" } }));

const { putBooking } = await import("@/lib/server/shops");
const { PUT: barberPut } = await import("@/app/api/barber/[token]/bookings/[id]/route");
const { newWalkIn } = await import("@/lib/walkin-visit");
const { dayTotals } = await import("@/lib/counts");

const NOW = Date.now();
const day = new Date(NOW + 8 * 3600_000).toISOString().slice(0, 10);
const chairs = [{ id: "c1", label: "Chair 1", barberId: "b-ray", barberName: "Ray", number: 1, locationId: "pacita", sharePct: 40, shareSet: true }];
const bookings = () => Object.entries(fs.store).filter(([k]) => k.startsWith("shops/owner-uid/bookings/")).map(([, v]) => v as Record<string, unknown>);
const viaBarber = (b: Record<string, unknown>) => barberPut(new Request("http://local", { method: "PUT", body: JSON.stringify({ booking: b }) }), { params: Promise.resolve({ token: "raytoken123", id: b.id }) } as never);

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  Object.assign(fs.store, { "shops/owner-uid": { name: "Shop", plan: "pro", menu: [{ id: "haircut", name: "Haircut", price: 20_000, kind: "haircut", durationMins: 30 }] }, "shops/owner-uid/private/chairs": { json: JSON.stringify(chairs) }, "chairLinks/raytoken123": { shopId: "owner-uid", chairId: "c1" } });
});

describe("v1.0.38 idempotent offline retries", () => {
  it("a barber walk-in sent three times (start, retry, finish, retry) is one haircut", async () => {
    const w = { ...newWalkIn({ shopId: "owner-uid", ref: "W1", haircut: { name: "Haircut", price: 200 }, at: NOW }), status: "in_chair", chairLabel: "Chair 1", startedAt: NOW, locationId: "pacita" };
    expect((await viaBarber(w)).status).toBe(200);
    expect((await viaBarber(w)).status).toBe(200);
    const fin = { ...w, status: "done", completedAt: NOW, paid: true, payMethod: "cash" };
    expect((await viaBarber(fin)).status).toBe(200);
    expect((await viaBarber(fin)).status).toBe(200);
    expect(bookings()).toHaveLength(1);
    expect(dayTotals(bookings() as never, chairs as never, day).get("b-ray@pacita")!.haircuts).toBe(1);
  });

  it("a late retry of an older step never moves a finished haircut back", async () => {
    const w = { ...newWalkIn({ shopId: "owner-uid", ref: "W2", haircut: { name: "Haircut", price: 200 }, at: NOW }), status: "in_chair", chairLabel: "Chair 1", startedAt: NOW };
    await viaBarber(w);
    await viaBarber({ ...w, status: "done", completedAt: NOW, paid: true, payMethod: "cash" });
    await viaBarber(w);
    expect(bookings()).toHaveLength(1);
    expect(bookings()[0]!.status).toBe("done");
  });

  it("an owner-added record retried is one record and stays an added record", async () => {
    const at = NOW - 3600_000;
    const r = { id: "wk-m1-abc", ref: "M1", channel: "walk-in", status: "done", source: "manual", serviceName: "Haircut", serviceId: "haircut", price: 20_000, createdAt: at, completedAt: at, startedAt: at, paid: true, payMethod: "cash", payWhere: "shop", barberId: "b-ray", barberName: "Ray", locationId: "pacita" };
    await putBooking("owner-uid", r as never);
    await putBooking("owner-uid", r as never);
    expect(bookings()).toHaveLength(1);
    expect(bookings()[0]!.source).toBe("manual");
  });
});
