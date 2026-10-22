import { describe, expect, it } from "vitest";
import { doneOnDay, monthGrid, queueDayLabel } from "@/lib/queue-day";
import { rowsForLocation } from "@/lib/queue-location";

const at = (iso: string) => new Date(iso).getTime();
const rows = [
  { id: "a", status: "done", completedAt: at("2026-10-21T23:30:00+08:00"), updatedAt: 0, locationId: "makati" },
  { id: "b", status: "done", completedAt: at("2026-10-22T00:10:00+08:00"), updatedAt: 0 },
  { id: "c", status: "done", completedAt: at("2026-10-21T09:00:00+08:00"), updatedAt: 0 },
  { id: "d", status: "in_chair", updatedAt: at("2026-10-21T10:00:00+08:00") },
  { id: "e", status: "done", updatedAt: at("2026-10-21T15:00:00+08:00") },
];

describe("Queue date filter (Manila day)", () => {
  it("keeps only done rows completed that Manila day, newest first", () => {
    expect(doneOnDay(rows, "2026-10-21").map((r) => r.id)).toEqual(["a", "e", "c"]);
    expect(doneOnDay(rows, "2026-10-22").map((r) => r.id)).toEqual(["b"]);
  });
  it("uses Manila time, not UTC (00:10 +08 is Oct 22)", () => expect(doneOnDay(rows, "2026-10-21").some((r) => r.id === "b")).toBe(false));
  it("empty for a day with nothing", () => expect(doneOnDay(rows, "2026-10-01")).toEqual([]));
  it("combines with the location filter", () => expect(doneOnDay(rowsForLocation(rows, "makati", false), "2026-10-21").map((r) => r.id)).toEqual(["a"]));
  it("labels Today or a short date", () => {
    const now = at("2026-10-22T20:00:00+08:00");
    expect(queueDayLabel("2026-10-22", now)).toBe("Today");
    expect(queueDayLabel("2026-10-21", now)).toBe("Oct 21");
    expect(queueDayLabel("2026-10-15", now)).toBe("Oct 15");
  });
  it("month grid pads to weekday", () => {
    const g = monthGrid(2026, 9); // Oct 2026 starts Thursday
    expect(g.slice(0, 4)).toEqual([null, null, null, null]);
    expect(g[4]).toBe("2026-10-01");
    expect(g.filter(Boolean)).toHaveLength(31);
  });
});
