import { afterEach, describe, expect, it, vi } from "vitest";
import { doneInRange, doneLabel } from "@/lib/done-range";
import { setCustomRange } from "@/lib/sales-report";
import type { ChairRequest } from "@/lib/chair-bookings";

// 2026-10-19 10:00 Manila (02:00Z). Manila midnight = 2026-10-18T16:00Z.
const NOW = Date.parse("2026-10-19T02:00:00Z");
const at = (iso: string) => Date.parse(iso);
const v = (id: string, completedAt: number, status: ChairRequest["status"] = "done") =>
  ({ id, status, completedAt, updatedAt: completedAt, createdAt: completedAt } as ChairRequest);

afterEach(() => { vi.useRealTimers(); setCustomRange("", ""); });

describe("Queue done list date filter (Asia/Manila)", () => {
  it("TC-QUEUE-HP-01 default Today shows only visits finished since Manila midnight", () => {
    vi.useFakeTimers({ now: NOW });
    const rows = [v("today", at("2026-10-19T01:00:00Z")), v("oct17", at("2026-10-17T05:00:00Z")), v("oct16", at("2026-10-16T05:00:00Z"))];
    expect(doneInRange(rows, "today").map((r) => r.id)).toEqual(["today"]);
    expect(doneLabel("today")).toBe("Done today");
  });

  it("TC-QUEUE-ODD-01 a cut at 23:30 Manila yesterday (15:30Z) is not today; 00:10 Manila today (16:10Z) is", () => {
    vi.useFakeTimers({ now: NOW });
    const rows = [v("late-yesterday", at("2026-10-18T15:30:00Z")), v("just-after-midnight", at("2026-10-18T16:10:00Z"))];
    expect(doneInRange(rows, "today").map((r) => r.id)).toEqual(["just-after-midnight"]);
  });

  it("TC-QUEUE-HP-02 picking a date shows that day and labels it", () => {
    vi.useFakeTimers({ now: NOW });
    setCustomRange("2026-10-17", "2026-10-17");
    const rows = [v("today", at("2026-10-19T01:00:00Z")), v("oct17", at("2026-10-17T05:00:00Z"))];
    expect(doneInRange(rows, "custom").map((r) => r.id)).toEqual(["oct17"]);
    expect(doneLabel("custom")).toBe("Done · Oct 17");
  });

  it("TC-QUEUE-HP-03 a range shows every day in it, newest first, with a range label", () => {
    vi.useFakeTimers({ now: NOW });
    setCustomRange("2026-10-16", "2026-10-17");
    const rows = [v("oct16", at("2026-10-16T05:00:00Z")), v("oct17", at("2026-10-17T05:00:00Z")), v("today", at("2026-10-19T01:00:00Z"))];
    expect(doneInRange(rows, "custom").map((r) => r.id)).toEqual(["oct17", "oct16"]);
    expect(doneLabel("custom")).toBe("Done · Oct 16 – Oct 17");
  });

  it("TC-QUEUE-NEG-01 unfinished visits never appear in the done list", () => {
    vi.useFakeTimers({ now: NOW });
    expect(doneInRange([v("in-chair", at("2026-10-19T01:00:00Z"), "in_chair"), v("declined", at("2026-10-19T01:00:00Z"), "declined")], "today")).toEqual([]);
  });
});
