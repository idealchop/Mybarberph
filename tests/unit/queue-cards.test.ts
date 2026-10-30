import { describe, expect, it } from "vitest";
import { activeOnDay, doneOnDay } from "@/lib/queue-day";
import { mergeLiveRows } from "@/lib/cut-count";

// v1.0.25 Queue cards: Current = waiting/in the chair opened that Manila day; Completed = doneOnDay on the same merged source.
const d0 = Date.parse("2026-10-30T00:00:00+08:00");
const r = (id: string, status: string, createdAt: number, completedAt?: number) => ({ id, status, createdAt, updatedAt: completedAt ?? createdAt, completedAt });
describe("Queue Current / Completed cards", () => {
  it("counts per selected day; a visit finishing after midnight counts on its finish day; stale open visits stay on their own day", () => {
    const deep = [r("a", "done", d0 - 600_000, d0 + 300_000), r("b", "done", d0 + 3600_000, d0 + 5400_000), r("y", "done", d0 - 7200_000, d0 - 3600_000)];
    const live = [r("a", "done", d0 - 600_000, d0 + 300_000), r("b", "done", d0 + 3600_000, d0 + 5400_000), r("c", "in_chair", d0 + 7200_000), r("d", "accepted", d0 + 8000_000), r("e", "requested", d0 + 9000_000), r("f", "accepted", d0 - 86_400_000), r("g", "declined", d0 + 100)];
    const rows = mergeLiveRows(deep as never, live as never) as never as ReturnType<typeof r>[];
    expect(doneOnDay(rows as never, "2026-10-30").map((x: { id: string }) => x.id).sort()).toEqual(["a", "b"]);
    expect(activeOnDay(rows, "2026-10-30").map((x) => x.id)).toEqual(["c", "d", "e"]);
    expect(activeOnDay(rows, "2026-10-29").map((x) => x.id)).toEqual(["f"]);
  });
});
