import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// Real shops service on an in-memory Firestore. Only putBooking (pricing, limits, activity) is replaced by a spy.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
const putBooking = vi.fn(async (_shop: string, b: Record<string, unknown>, me: { barberId: string }) => ({ ...b, barberId: me.barberId }));
vi.mock("@/lib/server/shops", async (orig) => ({ ...(await orig<typeof import("@/lib/server/shops")>()), putBooking }));

const { GET } = await import("@/app/api/barber/[token]/route");
const { PUT } = await import("@/app/api/barber/[token]/bookings/[id]/route");
const { barberAccess, chairLink } = await import("@/lib/server/shops");

const NOW = Date.parse("2026-10-19T02:00:00Z");
const chairs = [
  { id: "c1", label: "Keith", barberId: "b-keith", barberName: "Keith", number: 1 },
  { id: "c2", label: "Jun", barberId: "b-jun", barberName: "Jun", number: 2 },
  { id: "c3", label: "Ana", barberId: "b-ana", barberName: "Ana", number: 3, locationId: "loc-2" },
];
const visit = (id: string, extra: Record<string, unknown>) => ({ id, shopId: "shop-a", status: "done", channel: "walk-in", createdAt: NOW - 1000, updatedAt: NOW, price: 250, ...extra });

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  putBooking.mockClear();
  Object.assign(fs.store, {
    "chairLinks/keithtoken1": { shopId: "shop-a", chairId: "c1", expiresAt: NOW - 30 * 86_400_000 },
    "shops/shop-a": { name: "Shop A", menu: [] },
    "shops/shop-a/private/chairs": { json: JSON.stringify(chairs) },
    "shops/shop-a/bookings/mine": visit("mine", { barberId: "b-keith" }),
    "shops/shop-a/bookings/juns": visit("juns", { barberId: "b-jun" }),
    "shops/shop-a/bookings/legacy-seat": visit("legacy-seat", { seatLabel: "Keith" }),
    "shops/shop-a/bookings/waiting": visit("waiting", { status: "requested", channel: "online" }),
    "shops/shop-a/bookings/other-loc": visit("other-loc", { status: "requested", locationId: "loc-2" }),
    "shops/shop-a/bookings/unassigned-done": visit("unassigned-done", {}),
  });
});

const ctx = (token: string, id?: string) => ({ params: Promise.resolve(id ? { token, id } : { token }) }) as never;
const put = (id: string, body: Record<string, unknown> = {}) =>
  PUT(new Request("http://local", { method: "PUT", body: JSON.stringify({ booking: { id, status: "in_chair", ...body } }) }), ctx("keithtoken1", id));

describe("Barber link: own bookings only (server)", () => {
  it("TC-BARBER-HP-02 GET returns only this barber's visits plus open ones waiting at their location", async () => {
    const res = await GET(new Request("http://local"), ctx("keithtoken1"));
    expect(res.status).toBe(200);
    const ids = ((await res.json()).bookings as { id: string }[]).map((b) => b.id).sort();
    expect(ids).toEqual(["legacy-seat", "mine", "waiting"]);
  });

  it("TC-BARBER-NEG-03 PUT on another barber's visit is 404 and nothing is written", async () => {
    const res = await put("juns");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "not_found" });
    expect(putBooking).not.toHaveBeenCalled();
  });

  it("TC-BARBER-NEG-04 PUT on a visit at another location, or an unassigned finished one, is 404", async () => {
    expect((await put("other-loc")).status).toBe(404);
    expect((await put("unassigned-done")).status).toBe(404);
    expect(putBooking).not.toHaveBeenCalled();
  });

  it("TC-BARBER-HP-03 accepting an open waiting visit stamps this barber; own visits and new walk-ins save", async () => {
    expect((await put("waiting")).status).toBe(200);
    expect((await put("mine")).status).toBe(200);
    expect((await put("wk-new-walkin")).status).toBe(200);
    expect(putBooking).toHaveBeenCalledTimes(3);
    expect(putBooking.mock.calls.every((c) => (c[2] as { barberId: string }).barberId === "b-keith")).toBe(true);
  });

  it("TC-BARBER-ODD-01 rule: barberId wins over a matching chair label", () => {
    const me = { barberId: "b-keith", barberName: "Keith", chairLabel: "Keith" };
    expect(barberAccess(visit("x", { barberId: "b-jun", seatLabel: "Keith" }) as never, me)).toBeNull();
    expect(barberAccess(visit("y", { barberId: "b-keith" }) as never, me)).toBe("own");
  });
});

describe("Barber links never expire", () => {
  it("TC-LINK-HP-02 a link with an old expiresAt (monthly expiry) still resolves", async () => {
    expect(await chairLink("keithtoken1")).toEqual({ shopId: "shop-a", chairId: "c1" });
  });
  it("TC-LINK-NEG-01 a reset, removed or deactivated link (doc deleted) is 404 with the new text", async () => {
    const res = await GET(new Request("http://local"), ctx("oldtoken123"));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "not_found", error: "This link was replaced or turned off." });
  });
});
