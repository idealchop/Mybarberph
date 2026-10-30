import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.28: owner walk-ins are saved under the active location and marked as the owner's (source + uid).
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("@/lib/server/activity", () => ({ bookingActivity: vi.fn(async () => undefined), stateActivity: vi.fn(async () => undefined), logActivity: vi.fn(async () => undefined), OWNER: { name: "Owner", role: "owner" } }));

const { putBooking } = await import("@/lib/server/shops");
const { PUT: barberPut } = await import("@/app/api/barber/[token]/bookings/[id]/route");
const { walkInLocation } = await import("@/lib/walkin-location");
const { ownerDayTotal, dayTotals } = await import("@/lib/counts");
const { dayBoard } = await import("@/lib/queue-day");
const { rowsForLocation } = await import("@/lib/queue-location");

const NOW = Date.now();
const day = new Date(NOW + 8 * 3600_000).toISOString().slice(0, 10);
const chairs = [{ id: "c1", label: "Chair 1", barberId: "b-ray", barberName: "Ray", number: 1, locationId: "pacita", sharePct: 40, shareSet: true }];
const saved = (id: string) => fs.store[`shops/owner-uid/bookings/${id}`] as Record<string, unknown>;
const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, ref: "A1", channel: "walk-in", status: "in_chair", serviceName: "Haircut", serviceId: "haircut", price: 20_000, createdAt: NOW, startedAt: NOW, ...extra });

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  Object.assign(fs.store, { "shops/owner-uid": { name: "Shop", plan: "pro", menu: [{ id: "haircut", name: "Haircut", price: 20_000, kind: "haircut", durationMins: 30 }] }, "shops/owner-uid/private/chairs": { json: JSON.stringify(chairs) }, "chairLinks/raytoken123": { shopId: "owner-uid", chairId: "c1" } });
});

describe("owner walk-in location", () => {
  const br = [{ id: "pacita" }, { id: "bayan" }];
  it("uses the active branch, and asks for a pick on All locations", () => {
    expect(walkInLocation({ enabled: true, viewingAll: false, scopeId: "pacita", branches: br })).toEqual({ locationId: "pacita", needsPick: false });
    expect(walkInLocation({ enabled: true, viewingAll: true, scopeId: null, branches: br })).toEqual({ locationId: null, needsPick: true });
    expect(walkInLocation({ enabled: true, viewingAll: true, scopeId: null, branches: br }, "bayan")).toEqual({ locationId: "bayan", needsPick: false });
    expect(walkInLocation({ enabled: true, viewingAll: true, scopeId: null, branches: br }, "nope").needsPick).toBe(true);
    expect(walkInLocation({ enabled: false, viewingAll: false, scopeId: null, branches: [] })).toEqual({ locationId: "home", needsPick: false });
  });
});

const viaBarber = (b: Record<string, unknown>) => barberPut(new Request("http://local", { method: "PUT", body: JSON.stringify({ booking: b }) }), { params: Promise.resolve({ token: "raytoken123", id: b.id }) } as never);
const AUDIT = ["id", "ref", "createdAt", "updatedAt", "startedAt", "completedAt", "createdBy", "addedBy", "editLog"];
const strip = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([k]) => !AUDIT.includes(k)));
const done = { status: "done", completedAt: NOW, paid: true, payMethod: "cash" };

describe("owner walk-in record (server)", () => {
  it("owner's own haircut: barberId owner, under the active location, audit marker owner uid", async () => {
    await putBooking("owner-uid", row("wk-1", { locationId: "pacita", barberId: "owner", barberName: "Owner" }));
    const s = saved("wk-1");
    expect([s.createdBy, s.addedBy, s.locationId, s.barberId, s.source]).toEqual(["owner-uid", "owner", "pacita", "owner", undefined]);
  });
  it("a client can't forge the audit marker, and later saves keep it", async () => {
    await putBooking("owner-uid", row("wk-2", { locationId: "pacita", barberId: "b-ray", barberName: "Ray", chairLabel: "Chair 1", createdBy: "someone-else", addedBy: "barber" }));
    expect([saved("wk-2").createdBy, saved("wk-2").addedBy]).toEqual(["owner-uid", "owner"]);
    await putBooking("owner-uid", { ...saved("wk-2"), ...done, createdBy: "x", addedBy: "barber" } as never);
    expect([saved("wk-2").createdBy, saved("wk-2").addedBy]).toEqual(["owner-uid", "owner"]);
  });
  it("owner-added for a barber is identical to a barber-added visit, except the audit marker", async () => {
    const base = { locationId: "pacita", barberId: "b-ray", barberName: "Ray", chairLabel: "Chair 1", seatLabel: "Chair 1" };
    await putBooking("owner-uid", row("wk-o", base));
    expect((await viaBarber(row("wk-b", base))).status).toBe(200);
    await putBooking("owner-uid", { ...saved("wk-o"), ...done } as never);
    expect((await viaBarber({ ...saved("wk-b"), ...done })).status).toBe(200);
    const o = saved("wk-o"), b = saved("wk-b");
    expect(strip(o)).toEqual(strip(b));
    expect(o.splitPct).toBe(40);
    expect([o.addedBy, b.addedBy]).toEqual(["owner", "barber"]);
    const per = dayTotals([o, b] as never, chairs as never, day).get("b-ray@pacita")!;
    expect(per.haircuts).toBe(2);
    const one = (r: unknown) => dayTotals([r] as never, chairs as never, day).get("b-ray@pacita");
    expect(one(o)).toEqual(one(b));
    const { isClaimable } = await import("@/lib/claim-rule");
    expect([isClaimable(o as never), isClaimable(b as never)]).toEqual([true, true]);
  });
  it("counts in that location's Home/Queue/Sales; a barber's if picked, else the owner's own", async () => {    await putBooking("owner-uid", row("wk-3", { locationId: "pacita", barberId: "owner", barberName: "Owner" }));
    await putBooking("owner-uid", row("wk-4", { locationId: "pacita", barberId: "b-ray", barberName: "Ray", chairLabel: "Chair 1" }));
    for (const id of ["wk-3", "wk-4"]) await putBooking("owner-uid", { ...saved(id), status: "done", completedAt: NOW, paid: true, payMethod: "cash" } as never);
    const rows = ["wk-3", "wk-4"].map((id) => saved(id)) as never[];
    const pacita = rowsForLocation(rows, "pacita", false, "home");
    expect(pacita).toHaveLength(2);
    expect(rowsForLocation(rows, "bayan", false, "home")).toHaveLength(0);
    expect(dayBoard(pacita, day).done).toBe(2);
    expect(ownerDayTotal(rows, chairs as never, day, "pacita").haircuts).toBe(2);
    expect(ownerDayTotal(rows, chairs as never, day, "bayan").haircuts).toBe(0);
    const per = dayTotals(rows, chairs as never, day);
    expect(per.get("b-ray@pacita")?.haircuts).toBe(1);
    expect(per.get("owner@pacita")?.haircuts).toBe(1);
  });
});
