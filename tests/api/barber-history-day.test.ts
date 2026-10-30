import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// Barber link History (v1.0.21): one Manila day from the server, raw rows normalised, owner-claimed cuts locked,
// and barber edits recorded in the visit's edit log.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
const { GET } = await import("@/app/api/barber/[token]/history/route");
const { PUT } = await import("@/app/api/barber/[token]/bookings/[id]/route");
const { historyRow } = await import("@/lib/barber-history");

const at = (iso: string) => Date.parse(iso);
const TOKEN = "historytok1";
const chairs = [{ id: "c1", label: "Keith", barberId: "b-keith", barberName: "Keith", number: 1, sharePct: 50, shareSet: true }];
const cut = (id: string, completedAt: number, extra: Record<string, unknown> = {}) =>
  ({ id, ref: `W-${id}`, shopId: "shop-a", status: "done", channel: "walk-in", createdAt: completedAt - 3600_000, updatedAt: completedAt, completedAt, price: 20000, serviceName: "Haircut", paid: true, payMethod: "cash", barberId: "b-keith", barberName: "Keith", ...extra });

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  Object.assign(fs.store, {
    [`chairLinks/${TOKEN}`]: { shopId: "shop-a", chairId: "c1" },
    "shops/shop-a": { name: "Shop A", menu: [{ id: "haircut", name: "Haircut", price: 20000 }] },
    "shops/shop-a/private/chairs": { json: JSON.stringify(chairs) },
    "shops/shop-a/bookings/cut-a": cut("cut-a", at("2026-10-29T16:30:00Z")), // 00:30 PHT Oct 30
    "shops/shop-a/bookings/cut-b": cut("cut-b", at("2026-10-29T15:30:00Z")), // 23:30 PHT Oct 29
    "shops/shop-a/bookings/cut-c": cut("cut-c", at("2026-10-30T02:00:00Z"), { barberId: "b-jun" }),
    // Legacy/partner doc: no id, ref or serviceName field stored.
    "shops/shop-a/bookings/legacy1": { status: "done", completedAt: at("2026-10-30T03:00:00Z"), createdAt: at("2026-10-30T02:00:00Z"), price: 15000, barberId: "b-keith" },
    "shops/shop-a/remitClaims/k1": { id: "k1", barberId: "b-keith", locationId: "home", bookingIds: ["cut-a"], amount: 20000, claimedAt: at("2026-10-30T05:00:00Z") },
  });
});
const get = (date: string) => GET(new Request(`http://local/api/barber/${TOKEN}/history?date=${date}`), { params: Promise.resolve({ token: TOKEN }) } as never);
const put = (id: string, booking: Record<string, unknown>) =>
  PUT(new Request("http://local", { method: "PUT", body: JSON.stringify({ booking: { ...(fs.store[`shops/shop-a/bookings/${id}`] as object), ...booking, id } }) }), { params: Promise.resolve({ token: TOKEN, id }) } as never);

describe("Barber link History by Manila day", () => {
  it("returns this barber's finished cuts for that Manila day, raw rows normalised, claimed ids listed", async () => {
    const r = await get("2026-10-30");
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.rows.map((x: { id: string }) => x.id).sort()).toEqual(["cut-a", "legacy1"]);
    const legacy = d.rows.find((x: { id: string }) => x.id === "legacy1");
    expect(legacy).toMatchObject({ ref: "", serviceName: "Haircut", customerLabel: "" });
    expect(d.locked).toEqual(["cut-a"]);
    expect((await (await get("2026-10-29")).json()).rows.map((x: { id: string }) => x.id)).toEqual(["cut-b"]);
  });
  it("historyRow never leaves string fields undefined", () => {
    expect(historyRow("doc9", {} as never)).toMatchObject({ id: "doc9", ref: "", serviceName: "Haircut", price: 0 });
  });
});

describe("Barber edits from History", () => {
  it("an owner-claimed cut is locked for the barber (409, nothing written)", async () => {
    const before = JSON.stringify(fs.store["shops/shop-a/bookings/cut-a"]);
    const res = await put("cut-a", { payMethod: "gcash" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("locked");
    expect(JSON.stringify(fs.store["shops/shop-a/bookings/cut-a"])).toBe(before);
  });
  it("an unclaimed past-day cut can be edited; the change is logged with who/when/old → new", async () => {
    const res = await put("cut-b", { payMethod: "gcash" });
    expect(res.status).toBe(200);
    const saved = fs.store["shops/shop-a/bookings/cut-b"] as { payMethod: string; editLog: { by: string; role: string; at: number; changes: string[] }[] };
    expect(saved.payMethod).toBe("gcash");
    expect(saved.editLog.at(-1)).toMatchObject({ by: "Keith", role: "barber", changes: ["Payment: cash → GCash"] });
    expect(saved.editLog.at(-1)!.at).toBeGreaterThan(0);
  });
});
