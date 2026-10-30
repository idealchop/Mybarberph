import { describe, expect, it } from "vitest";
import { addDays, dayLabel, dayOf, earningsOf } from "@/lib/barber-history";
import { countToday } from "@/lib/cut-count";
import type { ChairRequest } from "@/lib/booking-types";

const NOW = Date.parse("2026-10-27T19:00:00+08:00");
let n = 0;
const r = (iso: string, p: Partial<ChairRequest> = {}) => ({ id: `h${++n}`, status: "done", completedAt: Date.parse(iso), price: 20000, ...p }) as ChairRequest;
const rows = [
  r("2026-10-27T00:05:00+08:00"), r("2026-10-27T18:30:00+08:00", { tip: 5000 }),
  r("2026-10-26T23:55:00+08:00"), r("2026-10-26T10:00:00+08:00"),
  r("2026-10-27T12:00:00+08:00", { status: "in_chair", completedAt: undefined }),
  r("2026-10-27T12:00:00+08:00", { status: "cancelled" }),
];

describe("barber History day by day", () => {
  it("each day counts done + completedAt on its Manila date (same as countToday / Sales)", () => {
    expect(dayOf("2026-10-27", rows, 40).cuts).toBe(2);
    expect(dayOf("2026-10-26", rows, 40).cuts).toBe(2);
    expect(dayOf("2026-10-27", rows, 40).cuts).toBe(countToday(rows, NOW));
  });
  it("earnings = barber share only (tips separate); full sales when no share is set", () => {
    const d = dayOf("2026-10-27", rows, 40);
    expect(d.sales).toBe(40000); expect(d.tips).toBe(5000); expect(d.earnings).toBe(16000);
    expect(earningsOf(40000, 0, null)).toBe(40000);
  });
  it("labels and day math in Manila time", () => {
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(dayLabel("2026-10-27", NOW)).toBe("Today, Oct 27");
    expect(dayLabel("2026-10-26", NOW)).toBe("Yesterday, Oct 26");
    expect(dayLabel("2026-10-19", NOW)).toBe("Mon, Oct 19");
  });
});
