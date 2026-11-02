import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { barberText, barberWho } from "@/lib/barber-wording";

// v1.0.42: barber view says "Customer(s)", never "walk-in(s)". Display only; stored data unchanged.
describe("barber view wording", () => {
  it("maps singular/plural and case", () => {
    expect(barberText("You've seated 10 walk-ins today, the Partner limit. Upgrade to Pro or Lifetime for unlimited walk-ins."))
      .toBe("You've seated 10 customers today, the Partner limit. Upgrade to Pro or Lifetime for unlimited customers.");
    expect(barberText("3 of 10 walk-ins left today")).toBe("3 of 10 customers left today");
    expect(barberText("Add walk-in")).toBe("Add customer");
    expect(barberText("Walk-in")).toBe("Customer");
    expect(barberText("Walkins")).toBe("Customers");
  });
  it("stored 'Walk-in' placeholder reads Customer; real names kept", () => {
    expect(barberWho("Walk-in")).toBe("Customer");
    expect(barberWho("")).toBe("Customer");
    expect(barberWho("Juan")).toBe("Juan");
  });
  it("barber screens have no walk-in display text", () => {
    const src = readFileSync("src/features/barber/barber-link-screen.tsx", "utf8").split("\n")
      .filter((l) => !/^\s*(\/\/|\*|import)/.test(l)).join("\n")
      .replace(/onWalkIn|WalkIn\w*|newWalkIn|seatWalkInOnChair|"walk-in"/g, "");
    expect(src).not.toMatch(/["'>`][^"'<`\n]*walk-?ins?\b/i);
  });
});
