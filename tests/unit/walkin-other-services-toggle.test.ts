import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../../src/features/walkin/walk-in-screen.tsx", import.meta.url), "utf8");

describe("Owner Walk-in Other services toggle", () => {
  it("folds other services behind a centred text toggle until tapped", () => {
    expect(src).toContain("Other services");
    expect(src).toMatch(/const \[showOther, setShowOther\] = useState\(false\)/);
    expect(src).toMatch(/aria-expanded=\{showOther \|\| picked\.length > 0\}/);
    expect(src).toMatch(/justify-center/);
    expect(src).toContain("ChevronDown");
    // Always-visible heading (old) must not remain as a static label above the list.
    expect(src).not.toMatch(/<p className="mt-4 text-\[13px\] font-bold">Other services<\/p>/);
  });

  it("keeps the list open when an add-on is already selected", () => {
    expect(src).toMatch(/showOther \|\| picked\.length > 0 \? \(/);
  });

  it("Name field uses the large Input (16px+) and selects are at least 16px", () => {
    expect(src).toMatch(/<Input label="Name"/);
    expect(src).toMatch(/text-\[16px\] font-semibold/);
    expect(src).not.toMatch(/autoFocus|autofocus/);
  });
});
