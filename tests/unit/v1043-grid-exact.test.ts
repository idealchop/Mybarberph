import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gridNames, gridPeso } from "@/lib/profit-report";

// v1.0.43: Weekly Profit Report grid shows exact amounts (Jimboy: "show actual and not round up").
describe("grid exact amounts", () => {
  it("pesos with commas, no k, no rounding", () => {
    expect(gridPeso(238000)).toBe("2,380");
    expect(gridPeso(210000)).toBe("2,100");
    expect(gridPeso(11000)).toBe("110");
    expect(gridPeso(11363500)).toBe("113,635");
    expect(gridPeso(150050)).toBe("1,500.50");
    expect(gridPeso(0)).toBe("0");
    expect(gridPeso(-84000)).toBe("-840");
  });
  it("first names; a shared first name gets the last initial", () => {
    expect(gridNames(["Ernie Dela Cruz", "Raymond Dias", "Raymond Caasi", "MJ"])).toEqual(["Ernie", "Raymond D.", "Raymond C.", "MJ"]);
  });
  it("the grid no longer uses k abbreviations", () => {
    const src = readFileSync("src/features/sales/profit-report-screen.tsx", "utf8");
    expect(src).not.toContain("compactPeso(");
    expect(src).toContain("useFitNumbers");
  });
});
