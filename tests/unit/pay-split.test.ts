import { describe, expect, it } from "vitest";
import { payBucket, payMethodLabel, paySplit, splitParts } from "@/lib/pay-split";
import { barberStats } from "@/lib/sales-stats";
import { salesReport } from "@/lib/sales-report";
import type { ChairRequest } from "@/lib/chair-bookings";

const now = Date.now();
const visit = (over: Partial<ChairRequest>): ChairRequest => ({
  id: Math.random().toString(36).slice(2), ref: "A1", status: "done", price: 10000, createdAt: now, completedAt: now, updatedAt: now,
  payWhere: "shop", channel: "walk-in", barberId: "b1", barberName: "Ben", locationId: "home", serviceName: "Haircut",
  ...over,
} as ChairRequest);

describe("Collected split by payment method", () => {
  it("TC-PAY-HP-01 splits paid visits into Cash and GCash from the stored method", () => {
    const s = paySplit([visit({ paid: true, payMethod: "cash" }), visit({ paid: true, payMethod: "gcash", price: 25000 }), visit({ paid: true, payMethod: "cash", price: 5000 })]);
    expect(s).toEqual({ cash: 15000, gcash: 25000, online: 0, other: 0 });
    expect(splitParts(s).map((p) => p.label)).toEqual(["Cash", "GCash"]);
  });

  it("TC-PAY-ODD-01 a paid visit with no stored method counts and shows as Cash, as on the server (Jimboy, 2026-10-20)", () => {
    const legacy = visit({ paid: true, payMethod: undefined });
    expect(payBucket(legacy)).toBe("cash");
    expect(payMethodLabel(legacy)).toBe("Cash");
    const s = paySplit([legacy, visit({ paid: true, payMethod: "cash" })]);
    expect(s).toMatchObject({ cash: 20000, other: 0 });
    expect(splitParts(s).map((p) => p.label)).toEqual(["Cash", "GCash"]);
  });

  it("TC-PAY-NEG-01 unpaid visits are not collected and have no method label", () => {
    expect(paySplit([visit({ paid: false, payMethod: "cash" })])).toEqual({ cash: 0, gcash: 0, online: 0, other: 0 });
    expect(payMethodLabel(visit({ paid: false }))).toBeNull();
  });

  it("TC-PAY-HP-02 the sales report's collected total equals the sum of its split", () => {
    const rows = [visit({ paid: true, payMethod: "cash" }), visit({ paid: true, payMethod: "gcash" }), visit({ paid: true }), visit({ paid: false })];
    const r = salesReport(rows, 10000, "today");
    const s = r.collectedSplit;
    expect(s.cash + s.gcash + s.online + s.other).toBe(r.collected);
    expect(r.payments.map((p) => p.label)).not.toContain("Other");
  });

  it("TC-PAY-ODD-02 per barber: split by method; no-method is cash; remit = cash, online excluded", () => {
    const rows = [visit({ paid: true, payMethod: "cash" }), visit({ paid: true, payMethod: "gcash" }), visit({ paid: true }), visit({ paid: true, payMethod: "online" })];
    const [b] = barberStats(rows, "today", "all", [{ id: "home", name: "Main" }], []);
    expect(b).toMatchObject({ cash: 20000, gcash: 10000, other: 0, online: 10000, remit: 20000 });
  });
});
