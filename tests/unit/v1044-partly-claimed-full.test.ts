import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cellSplit } from "@/lib/profit-barber-week";

// v1.0.44 (Jimboy): a partly claimed day shows its FULL total only, red while any part is unclaimed; no "+840" line.
describe("partly claimed day shows the full total", () => {
  it("no claimed subline in the owner grid or barber week rows", () => {
    for (const f of ["src/features/sales/profit-report-screen.tsx", "src/features/sales/profit-barber-week.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toContain("cell-claimed");
      expect(s).not.toContain("day-split");
      expect(s).not.toMatch(/\+ ?\{(peso|gridPeso)\(/);
    }
    expect(readFileSync("src/features/sales/profit-report-screen.tsx", "utf8")).toContain("<Amount n={n} future={false} />");
  });
  it("mixed stays red (to-claim style); header parts still split", () => {
    const s = cellSplit(294000, { open: 30, claimed: 12, openOwner: 210000 });
    expect(s).toEqual({ toClaim: 210000, claimed: 84000, state: "mixed" });
    expect(readFileSync("src/features/sales/profit-barber-week.tsx", "utf8")).toContain('d.state === "open" || d.state === "mixed" ? "border-[#C62828]/60 text-[#C62828]"');
    expect(readFileSync("src/features/sales/profit-report-screen.tsx", "utf8")).toContain('sp?.state === "mixed" ? "open"');
  });
});
