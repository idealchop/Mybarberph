import { describe, expect, it } from "vitest";
import { applyPendingClaim, rollbackPendingClaim, type OptRemit, type PendingClaim } from "@/lib/remit-optimistic";
import { claimStates, cellClaimState } from "@/lib/profit-claim";

const base = (): OptRemit => ({
  unclaimed: [{ barberId: "b1", locationId: "home", amount: 500, ownerShare: 250, count: 2 }, { barberId: "b2", locationId: "home", amount: 300, ownerShare: 150, count: 1 }],
  total: 800, ownerTotal: 400, claims: [],
});
const visits = [
  { id: "v1", status: "done", paid: true, payMethod: "cash", price: 250, barberId: "b1", locationId: "home", completedAt: Date.parse("2026-10-30T10:00:00+08:00") },
  { id: "v2", status: "done", paid: true, payMethod: "gcash", price: 250, barberId: "b1", locationId: "home", completedAt: Date.parse("2026-10-30T11:00:00+08:00") },
];
const pend = (o: Partial<PendingClaim> = {}): PendingClaim => ({ id: "pending:1", barberId: "b1", locationId: "home", bookingIds: ["v1", "v2"], day: "2026-10-30", at: 1, ...o });
const stateOf = (d: OptRemit) => {
  const ids = new Set(d.claims.flatMap((c) => c.bookingIds ?? []));
  return cellClaimState(claimStates(visits, [], (r) => ids.has(r.id)).get("b1@home|2026-10-30"));
};

describe("optimistic claim", () => {
  it("turns the day green at once (cash and GCash)", () => {
    expect(stateOf(base())).toBe("open");
    expect(stateOf(applyPendingClaim(base(), pend(), "all"))).toBe("claimed");
  });
  it("whole-barber claim clears To Claim totals", () => {
    const d = applyPendingClaim(base(), pend({ day: undefined }), "home");
    expect(d.unclaimed.map((u) => u.barberId)).toEqual(["b2"]);
    expect(d.total).toBe(300); expect(d.ownerTotal).toBe(150);
  });
  it("ignores other location scopes and duplicates", () => {
    const b = base();
    expect(applyPendingClaim(b, pend(), "branch2")).toBe(b);
    const once = applyPendingClaim(b, pend(), "all");
    expect(applyPendingClaim(once, pend(), "all")).toBe(once);
  });
  it("rolls back to red when the claim fails", () => {
    const before = base();
    const opt = applyPendingClaim(before, pend({ day: undefined }), "all");
    const back = rollbackPendingClaim(opt, before, "pending:1");
    expect(stateOf(back)).toBe("open");
    expect(back.unclaimed).toHaveLength(2); expect(back.total).toBe(800);
  });
  it("rollback without snapshot just drops the pending claim", () => {
    const opt = applyPendingClaim(base(), pend(), "all");
    expect(rollbackPendingClaim(opt, null, "pending:1").claims).toHaveLength(0);
  });
});
