import { describe, expect, it } from "vitest";
import { rowsForLocation } from "@/lib/queue-location";
import { doneInRange } from "@/lib/done-range";

const now = Date.now();
const rows = [
  { id: "a", locationId: "home", status: "done", completedAt: now, updatedAt: now, createdAt: now },
  { id: "b", status: "done", completedAt: now, updatedAt: now, createdAt: now },
  { id: "c", locationId: "makati", status: "done", completedAt: now, updatedAt: now, createdAt: now },
  { id: "d", locationId: "makati", status: "in_chair", updatedAt: now, createdAt: now },
];

describe("Queue location filter", () => {
  it("main location keeps rows with no locationId", () => expect(rowsForLocation(rows, "home", false).map((r) => r.id)).toEqual(["a", "b"]));
  it("switching location filters done and open rows", () => {
    const m = rowsForLocation(rows, "makati", false);
    expect(m.map((r) => r.id)).toEqual(["c", "d"]);
    expect(doneInRange(m as never, "today").map((r: { id: string }) => r.id)).toEqual(["c"]);
  });
  it("all locations shows everything", () => expect(rowsForLocation(rows, "home", true)).toHaveLength(4));
});
