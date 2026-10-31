import { describe, expect, it } from "vitest";
import { claimAdjust, claimedValue, dayAdjustment, parseClaimAmount } from "@/lib/claim-adjust";
import { applyPendingClaim, rollbackPendingClaim } from "@/lib/remit-optimistic";

describe("adjusted claim", () => {
  it("parses peso input", () => {
    expect(parseClaimAmount("90")).toBe(90);
    expect(parseClaimAmount("₱1,250.50")).toBe(1250.5);
    expect(parseClaimAmount("")).toBeNull();
    expect(parseClaimAmount("abc")).toBeNull();
    expect(parseClaimAmount("-5")).toBeNull();
  });
  it("computes expected/received/difference", () => {
    expect(claimAdjust(90, 80)).toEqual({ expected: 90, received: 80, adjusted: true, difference: -10 });
    expect(claimAdjust(90, 90).adjusted).toBe(false);
    expect(claimAdjust(90, null)).toEqual({ expected: 90, received: 90, adjusted: false, difference: 0 });
  });
  it("reports use received when adjusted", () => {
    expect(claimedValue({ amount: 300, ownerShare: 90 })).toBe(90);
    expect(claimedValue({ amount: 300, ownerShare: 90, adjusted: true, received: 70 })).toBe(70);
  });
  it("sums a day's adjusted claims once each", () => {
    const c = { id: "a", adjusted: true, expected: 90, received: 70 };
    expect(dayAdjustment([c, c])).toEqual({ expected: 90, received: 70 });
    expect(dayAdjustment([{ id: "b" }])).toBeNull();
  });
  it("optimistic claim carries the adjustment and rolls back", () => {
    const d = { unclaimed: [], total: 0, claims: [] };
    const next = applyPendingClaim(d, { id: "pending:1", barberId: "b", locationId: "home", bookingIds: ["x"], day: "2026-10-31", at: 1, expected: 90, received: 70 }, "all");
    expect(next.claims[0]).toMatchObject({ adjusted: true, expected: 90, received: 70, difference: -20 });
    expect(rollbackPendingClaim(next, d, "pending:1").claims).toHaveLength(0);
    const same = applyPendingClaim(d, { id: "pending:2", barberId: "b", locationId: "home", bookingIds: ["x"], at: 1, expected: 90, received: 90 }, "all");
    expect((same.claims[0] as { adjusted?: boolean }).adjusted).toBeUndefined();
  });
});
