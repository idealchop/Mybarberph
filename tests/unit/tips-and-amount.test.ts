import { describe, expect, it } from "vitest";
import { lockedAmount, menuAmount, parseTip } from "@/lib/menu-amount";
import { paySplit, tipsTotal } from "@/lib/pay-split";
import { barberStats } from "@/lib/sales-stats";
import { salesReport } from "@/lib/sales-report";
import type { ChairRequest } from "@/lib/booking-types";

const menu = [{ name: "Haircut", price: 250 }, { name: "Beard trim", price: 100 }];
const NOW = Date.now();
const v = (id: string, x: Partial<ChairRequest>): ChairRequest => ({ id, shopId: "s", ref: id, channel: "walk-in", status: "done", contact: "", customerLabel: "", serviceId: "haircut", serviceName: "Haircut", price: 25_000, slotLabel: "Now", payWhere: "shop", createdAt: NOW, updatedAt: NOW, completedAt: NOW, barberId: "b1", barberName: "Keith", ...x });

describe("Locked barber amount (client mirror of the server rule)", () => {
  it("TC-BARBER-HP-06 menu total from the visit's services, plus a home fee; paid online keeps its amount", () => {
    expect(menuAmount(menu, "Haircut · Beard trim")).toBe(35_000);
    expect(menuAmount(menu, "Hot towel")).toBeNull();
    expect(lockedAmount({ serviceName: "Haircut", price: 24_000 }, menu)).toBe(25_000);
    expect(lockedAmount({ serviceName: "Haircut", price: 0, homeFee: 5_000 }, menu)).toBe(30_000);
    expect(lockedAmount({ serviceName: "Haircut", price: 22_000, paid: true, payWhere: "online", payMethod: "online" }, menu)).toBe(22_000);
  });
  it("TC-TIP-ODD-01 tip text becomes whole pesos (≥0)", () => {
    expect(parseTip("50")).toBe(50);
    expect(parseTip("₱75.9")).toBe(75);
    expect(parseTip("")).toBe(0);
    expect(parseTip("-")).toBe(0);
  });
});

describe("Tips in collected totals, not in sales, rankings or remit", () => {
  const rows = [
    v("a", { paid: true, payMethod: "cash", tip: 50 }),
    v("b", { paid: true, payMethod: "gcash", tip: 20 }),
    v("c", { paid: false, tip: 30 }),
  ];
  it("TC-TIP-HP-02 a tip counts under its payment's method; unpaid tips don't count yet", () => {
    expect(paySplit(rows)).toEqual({ cash: 30_000, gcash: 27_000, online: 0, other: 0 });
    expect(paySplit(rows, false)).toEqual({ cash: 25_000, gcash: 25_000, online: 0, other: 0 });
    expect(tipsTotal(rows)).toBe(7_000);
  });
  it("TC-TIP-HP-03 barber ranking: sales and remit are service amounts; tips shown apart", () => {
    const [k] = barberStats(rows, "today", "all", [{ id: "home", name: "Home" }], []);
    expect(k).toMatchObject({ sales: 75_000, cash: 30_000, gcash: 27_000, remit: 25_000, tips: 7_000, unpaid: 25_000 });
  });
  it("TC-TIP-HP-04 Sales Overview: Collected includes tips (incl. line), Sales doesn't", () => {
    const r = salesReport(rows, 25_000, "today");
    expect(r.sales).toBe(75_000);
    expect(r.collected).toBe(57_000);
    expect(r.tips).toBe(7_000);
  });
});
