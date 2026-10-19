import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";
import type { ChairRequest } from "@/lib/booking-types";

// One fixture, every view: owner client stats (Overview, Collection ranking, Performance) and the barber link's
// server numbers (My sales, /sales). Modelled on Jimboy's report of 2026-10-19: Keith has chairs in two branches.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));

const { barberPerformance, barberSales } = await import("@/lib/server/barber-sales");
const { GET: salesGET } = await import("@/app/api/barber/[token]/sales/route");
const { barberStats, rankedBarbers, serviceStats } = await import("@/lib/sales-stats");
const { salesReport } = await import("@/lib/sales-report");

const NOW = Date.now();
const chairs = [
  { id: "c-keith-sa", label: "Keith", barberId: "b-keith", barberName: "Keith", number: 1, locationId: "sa" },
  { id: "c-keith-pa", label: "Keith", barberId: "b-keith", barberName: "Keith", number: 1, locationId: "pacita" },
  { id: "c-jay", label: "Jay", barberId: "b-jay", barberName: "Jay", number: 2, locationId: "sa", active: false },
];
const v = (id: string, loc: string, svc: string, price: number, payMethod: "cash" | "gcash", x: Partial<ChairRequest> = {}): ChairRequest => ({
  id, shopId: "shop-a", ref: id, channel: "walk-in", status: "done", contact: "", customerLabel: "", serviceId: "haircut", serviceName: svc, price,
  slotLabel: "Now", payWhere: "shop", paid: true, payMethod, createdAt: NOW - 3_600_000, updatedAt: NOW, completedAt: NOW - 60_000,
  barberId: "b-keith", barberName: "Keith", locationId: loc, seatLabel: "Keith", ...x,
});
const visits = [
  v("BK-RC4YCQ", "sa", "Haircut · Wax", 55_000, "gcash"),
  v("BK-YWH5P2", "sa", "Haircut", 25_000, "cash"),
  v("BK-PA0001", "pacita", "Haircut · Wax", 50_000, "cash"),
  v("BK-PA0002", "pacita", "Haircut · Wax · Shaving", 65_000, "cash"),
  v("BK-PA0003", "pacita", "Haircut", 25_000, "cash"),
];

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  fs.store["chairLinks/keithsa0001"] = { shopId: "shop-a", chairId: "c-keith-sa" };
  fs.store["shops/shop-a"] = { name: "Shop A", menu: [] };
  fs.store["shops/shop-a/private/chairs"] = { json: JSON.stringify(chairs) };
  for (const x of visits) fs.store[`shops/shop-a/bookings/${x.id}`] = x;
});

const branches = [{ id: "sa", name: "San Antonio" }, { id: "pacita", name: "Bossing - Pacita Branch" }];

describe("Sales: every view agrees for the same shop, location and period", () => {
  it("TC-SALES-HP-01 San Antonio today: owner Overview = ranking = Keith's link My sales (₱800, 2 cuts)", async () => {
    const sa = visits.filter((x) => x.locationId === "sa");
    const overview = salesReport(sa, 0, "today");
    expect(overview).toMatchObject({ sales: 80_000, cuts: 2, collected: 80_000, collectedSplit: { cash: 25_000, gcash: 55_000, online: 0, other: 0 } });
    const ranking = rankedBarbers(barberStats(visits, "today", "sa", branches, chairs), chairs);
    expect(ranking.reduce((s, b) => s + b.sales, 0)).toBe(overview.sales);
    // Barber link "This week" (Mon–Sun, Manila) includes today; with only today's visits in the store it must match.
    const mine = await barberPerformance("shop-a", { range: "week", barberId: "b-keith", chairId: "c-keith-sa", locationId: "sa" });
    expect(mine).toMatchObject({ sales: 80_000, cuts: 2, cash: 25_000, gcash: 55_000 });
    expect(mine.services.reduce((s, x) => s + x.sales, 0)).toBe(mine.sales);
  });

  it("TC-SALES-NEG-01 regression: the San Antonio link no longer adds Keith's Pacita visits (was ₱2,200 / 5 cuts / Cash ₱1,650)", async () => {
    const mine = await barberPerformance("shop-a", { range: "week", barberId: "b-keith", chairId: "c-keith-sa", locationId: "sa" });
    expect(mine.sales).not.toBe(220_000);
    expect(mine.services.map((x) => x.name).sort()).toEqual(["Haircut", "Haircut · Wax"]);
    const pacita = await barberPerformance("shop-a", { range: "week", barberId: "b-keith", chairId: "c-keith-pa", locationId: "pacita" });
    expect(pacita).toMatchObject({ sales: 140_000, cuts: 3, cash: 140_000, gcash: 0 });
  });

  it("TC-SALES-NEG-02 regression: the link's /sales 'mine' row is its own location, not the bigger branch", async () => {
    const res = await salesGET(new Request("http://local/api/barber/keithsa0001/sales?range=week"), { params: Promise.resolve({ token: "keithsa0001" }) } as never);
    const body = await res.json();
    expect(body.mine).toMatchObject({ locationId: "sa", gross: 80_000, cuts: 2 });
  });

  it("TC-SALES-ODD-01 all locations: owner total = sum of per-location barber rows = sum of both links", async () => {
    const all = salesReport(visits, 0, "today");
    const rows = rankedBarbers(barberStats(visits, "today", "all", branches, chairs), chairs);
    expect(rows.reduce((s, b) => s + b.sales, 0)).toBe(all.sales);
    const r = await barberSales("shop-a", { range: "week" });
    expect(r.total.gross).toBe(all.sales);
    expect(serviceStats(visits, "today", "all").reduce((s, x) => s + x.sales, 0)).toBe(all.sales);
  });

  it("TC-SALES-NEG-03 regression: a turned-off chair hides only an empty row at that location; sales never drop out of the ranking", () => {
    const withJay = [...visits, v("BK-JAY001", "sa", "Haircut", 25_000, "cash", { barberId: "b-jay", barberName: "Jay", seatLabel: "Jay" })];
    const off = [{ ...chairs[0]!, active: false }, chairs[1]!, chairs[2]!];
    const rows = rankedBarbers(barberStats(withJay, "today", "all", branches, off), off);
    expect(rows.reduce((s, b) => s + b.sales, 0)).toBe(salesReport(withJay, 0, "today").sales);
    expect(rows.find((b) => b.id === "b-keith" && b.locationId === "pacita")?.sales).toBe(140_000);
  });
});
