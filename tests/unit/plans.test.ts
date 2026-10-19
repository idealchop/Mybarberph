import { describe, expect, it } from "vitest";
import { maxLocations, normalizePlan, PARTNER_WALKINS_PER_DAY, planForLocations, tierForPlan, walkInLimit } from "@/lib/plans";
import { entitledPlan } from "@/lib/entitlements";

describe("plans", () => {
  it("TC-PLAN-HP-01 known plans map to their tier and limits", () => {
    expect(tierForPlan("pro_499")).toBe("paid");
    expect(maxLocations("lifetime_5")).toBe(5);
    expect(walkInLimit("partner")).toBe(PARTNER_WALKINS_PER_DAY);
    expect(walkInLimit("pro_499")).toBe(Infinity);
  });
  it("TC-PLAN-ODD-01 legacy plan ids still resolve", () => {
    expect(normalizePlan("monthly_950")).toBe("pro_499");
    expect(normalizePlan("lifetime_10000")).toBe("lifetime_5");
  });
  it("TC-PLAN-NEG-01 unknown, empty or null plans fall back to Partner", () => {
    expect(normalizePlan("gold")).toBe("partner");
    expect(normalizePlan("")).toBe("partner");
    expect(normalizePlan(null)).toBe("partner");
  });
  it("TC-PLAN-ODD-02 cheapest plan for a shop count (boundaries 1, 5, 6)", () => {
    expect(planForLocations(1).id).toBe("pro_499");
    expect(planForLocations(5).id).toBe("lifetime_5");
    expect(planForLocations(6).id).toBe("lifetime_unlimited");
  });
  it("TC-PLAN-HP-02 plan limits off (test phase) entitles every shop to all features", () => {
    delete process.env.PLAN_LIMITS_ENABLED;
    delete process.env.NEXT_PUBLIC_PLAN_LIMITS_ENABLED;
    expect(entitledPlan("partner")).toBe("lifetime_unlimited");
  });
  it("TC-PLAN-HP-03 plan limits on uses the stored plan", () => {
    process.env.PLAN_LIMITS_ENABLED = "1";
    try { expect(entitledPlan("partner")).toBe("partner"); } finally { delete process.env.PLAN_LIMITS_ENABLED; }
  });
});
