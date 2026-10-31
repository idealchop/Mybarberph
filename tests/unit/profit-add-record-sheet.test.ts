import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../../src/features/sales/profit-day-sheet.tsx", import.meta.url), "utf8");
const sheet = readFileSync(new URL("../../src/components/common/bottom-sheet.tsx", import.meta.url), "utf8");

describe("Add record sheet (v1.0.33)", () => {
  it("has no Time field; time comes from defaultManualTime at save", () => {
    expect(src).not.toMatch(/type="time"/);
    expect(src).toMatch(/time: defaultManualTime\(t\.day\)/);
  });
  it("shows Haircut first with an 'Other services' reveal", () => {
    expect(src).toContain("Other services");
    expect(src).toMatch(/f\.menu\.slice\(0, 1\)/);
  });
  it("Save has a loading spinner and a text Cancel below it", () => {
    expect(src).toMatch(/loading=\{add\.saving\}/);
    expect(src).toMatch(/>Cancel<\/button>/);
  });
  it("sheet portals to body above the bottom nav", () => {
    expect(sheet).toContain("createPortal");
    expect(sheet).toContain("z-[90]");
  });
});
