import { describe, expect, it } from "vitest";
import { asOwnerSplit, ownerPart } from "@/lib/split-view";
import { groupReport } from "@/lib/sales-groups";
import { barberStats } from "@/lib/sales-stats";
import { mergeLiveRows } from "@/lib/cut-count";
import type { ChairRequest } from "@/lib/booking-types";

// Owner Sales audit (Jimboy, 2026-10-30): every owner figure is the owner's split; only the Sales trend is full.
const now = Date.now();
const chairs = [
  { id: "c1", label: "Keith", barberId: "b1", barberName: "Keith", sharePct: 40, shareSet: true },
  { id: "c2", label: "Jun", barberId: "b2", barberName: "Jun", sharePct: 50, shareSet: true },
];
const row = (id: string, barberId: string, price: number, extra: Partial<ChairRequest> = {}) =>
  ({ id, shopId: "s", ref: id, channel: "walk-in", status: "done", contact: "", customerLabel: "", serviceId: "haircut", serviceName: "Haircut", price, slotLabel: "Now", payWhere: "shop", createdAt: now - 60_000, updatedAt: now, completedAt: now, paid: true, payMethod: "cash", barberId, tip: 5000, ...extra }) as ChairRequest;
const full = [row("r1", "b1", 20000), row("r2", "b2", 30000, { payMethod: "gcash" })];
const split = asOwnerSplit(full, chairs);
const ownerTotal = full.reduce((s, r) => s + ownerPart(r, chairs), 0); // 60% of 200 + 50% of 300 = 120 + 150

describe("Owner Sales shows only the owner's split", () => {
  it("rows: price = owner part, tips dropped, counts unchanged", () => {
    expect(ownerTotal).toBe(12000 + 15000);
    expect(split.map((r) => r.price)).toEqual([12000, 15000]);
    expect(split.every((r) => r.tip === undefined)).toBe(true);
    expect(split).toHaveLength(full.length);
  });
  it("Sales group total is the owner's share (no second split)", () => {
    const rep = groupReport(split, { id: "g", name: "All", locationIds: ["home"], barberIds: [] }, chairs as never, { loc: () => "Main" });
    expect(rep.gross).toBe(ownerTotal);
    expect(rep.tips).toBe(0);
  });
  it("My Barbers ranking sums the owner's share per barber", () => {
    const stats = barberStats(split, "today", "all", [{ id: "home", name: "Main" }], chairs);
    expect(stats.reduce((s, b) => s + b.sales, 0)).toBe(ownerTotal);
  });
  it("only the Sales trend uses full sales (merge of the unsplit rows)", () => {
    expect(mergeLiveRows(full, full).reduce((s, r) => s + r.price, 0)).toBe(50000);
  });
});
