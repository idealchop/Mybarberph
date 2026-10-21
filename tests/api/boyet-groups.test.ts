import { describe, expect, it } from "vitest";
import { planGroups } from "../../scripts/set-boyet-groups";
import { groupReport, normalizeGroups } from "@/lib/sales-groups";
import type { ChairRequest } from "@/lib/booking-types";

// Boyet's 20 DEV locations (names as of 2026-10-21).
const names: [string, string][] = [["home", "Main"], ["loc-dita-rotonda", "Dita Rotonda"], ["loc-lakeside-phase-3-2", "Lakeside Phase 3 II"], ["loc-windfield", "Windfield"], ["loc-sala", "Sala"], ["loc-lakeside-phase-3", "Lakeside Phase 3 I"]];

describe("Boyet sales groups", () => {
  it("puts the 3 named locations in Group B and the rest in Group A, no barbers", () => {
    const { groups, missing } = planGroups(names.slice(1).map(([id, name]) => ({ id, name })));
    expect(missing).toEqual([]);
    expect(groups.map((g) => g.name)).toEqual(["Group A", "Group B"]);
    expect(groups[1]!.locationIds.sort()).toEqual(["loc-dita-rotonda", "loc-lakeside-phase-3-2", "loc-windfield"]);
    expect(groups[0]!.locationIds).toContain("home");
    expect(groups[0]!.locationIds).not.toContain("loc-windfield");
    expect(groups.every((g) => g.barberIds.length === 0)).toBe(true);
  });
  it("reads back as exactly Group A and B, and every visit lands in one group", () => {
    const { groups } = planGroups(names.slice(1).map(([id, name]) => ({ id, name })));
    const saved = normalizeGroups(JSON.parse(JSON.stringify(groups)));
    expect(saved.map((g) => g.id)).toEqual(["ga", "gb"]);
    const rows = names.map(([id]) => ({ id, status: "done", price: 10_000, locationId: id === "home" ? undefined : id })) as unknown as ChairRequest[];
    const [a, b] = saved.map((g) => groupReport(rows, g, [], { loc: (x) => x }));
    expect(a!.cuts + b!.cuts).toBe(rows.length);
    expect(b!.cuts).toBe(3);
  });
});
