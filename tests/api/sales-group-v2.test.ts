import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { showsLocationFilter } from "@/lib/sales-filters";
import { groupLocationRows, groupReport, type SalesGroup } from "@/lib/sales-groups";
import type { ChairRequest } from "@/lib/booking-types";

describe("Sales group tab", () => {
  it("has no location filter; the other Sales tabs keep it", () => {
    expect(showsLocationFilter("groups")).toBe(false);
    for (const v of ["performance", "services", "barbers"]) expect(showsLocationFilter(v)).toBe(true);
    // The header renders the picker only through this guard.
    const src = readFileSync("src/features/sales/sales-data-screen.tsx", "utf8");
    expect(src).toMatch(/showsLocationFilter\(view\) && shops\.enabled/);
    expect(src.match(/<LocationSwitcher/g)?.length).toBe(1);
    expect(readFileSync("src/features/sales/sales-groups.tsx", "utf8")).not.toMatch(/LocationSwitcher/);
  });
  it("lists every group location with its barbers, highest first, ₱0 when no sales", () => {
    const g: SalesGroup = { id: "gb", name: "Group B", locationIds: ["a", "b", "c"], barberIds: [] };
    const chairs = [{ id: "c1", label: "1", barberId: "x", barberName: "Bon", locationId: "a" }, { id: "c2", label: "1", barberId: "y", barberName: "Ellie", locationId: "b" }];
    const rows = [{ id: "1", status: "done", price: 11500, locationId: "b" }, { id: "2", status: "done", price: 11500, locationId: "b" }, { id: "3", status: "done", price: 5000, locationId: "a" }] as ChairRequest[];
    const rep = groupReport(rows, g, chairs, { loc: (i) => i.toUpperCase() });
    const out = groupLocationRows(g, rep, chairs, { loc: (i) => i.toUpperCase() });
    expect(out.map((l) => [l.id, l.gross, l.barbers.map((b) => b.name).join()])).toEqual([["b", 23000, "Ellie"], ["a", 5000, "Bon"], ["c", 0, ""]]);
  });
});
