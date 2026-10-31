import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { claimAdjust, claimInputText, parseClaimCentavos } from "@/lib/claim-adjust";
import { peso } from "@/lib/format";

describe("v1.0.37 editing the To claim amount", () => {
  it("prefills the amount shown, in pesos (₱50 due → '50', not '5000')", () => {
    const due = 5000; // centavos, shown as ₱50
    expect(peso(due)).toContain("50");
    expect(claimInputText(claimAdjust(due, null).received)).toBe("50");
    expect(claimInputText(4550)).toBe("45.50");
    expect(claimInputText(0)).toBe("0");
  });
  it("prefills a previously adjusted amount", () => {
    expect(claimInputText(claimAdjust(5000, 4000).received)).toBe("40");
  });
  it("saves typed pesos as centavos; unchanged = not adjusted", () => {
    expect(parseClaimCentavos("50")).toBe(5000);
    expect(parseClaimCentavos("₱1,250.5")).toBe(125050);
    expect(parseClaimCentavos("abc")).toBeNull();
    expect(claimAdjust(5000, parseClaimCentavos(claimInputText(5000))).adjusted).toBe(false);
  });
  it("day sheet resets the edit per barber, branch, day and expected amount", () => {
    const src = readFileSync("src/features/sales/profit-day-sheet.tsx", "utf8");
    expect(src).toContain("const editKey = `${t.id}@${t.locationId}|${t.day}|${claim.open}`;");
    expect(src).toContain("setDraft(claimInputText(adj.received))");
    expect(src).not.toContain("setDraft(String(adj.received))");
  });
});
