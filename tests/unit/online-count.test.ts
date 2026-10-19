import { describe, expect, it } from "vitest";
import { onlineOpenToday } from "@/lib/chair-bookings";

// 2026-10-20 10:00 Manila = 02:00Z.
const NOW = Date.parse("2026-10-20T02:00:00Z");
const row = (id: string, x: Partial<{ channel: string; status: string; createdAt: number; scheduledAt: number }>) => ({ id, channel: "online", status: "requested", createdAt: NOW - 3600_000, ...x });

describe("Online count = today's open online bookings", () => {
  it("TC-QUEUE-HP-06 counts requested/accepted/in-chair online bookings today; never done, declined or walk-ins", () => {
    const rows = [
      row("new", {}), row("accepted", { status: "accepted" }), row("chair", { status: "in_chair" }),
      row("done", { status: "done" }), row("declined", { status: "declined" }), row("walk", { channel: "walk-in" }),
    ];
    expect(onlineOpenToday(rows, NOW).map((r) => r.id)).toEqual(["new", "accepted", "chair"]);
  });

  it("TC-QUEUE-HP-07 'today' is the Manila day of the slot (or creation): yesterday and tomorrow don't count", () => {
    const rows = [
      row("made-yesterday-for-today", { createdAt: NOW - 86_400_000, scheduledAt: NOW + 3600_000 }),
      row("made-today-for-tomorrow", { scheduledAt: NOW + 86_400_000 }),
      row("yesterday-left-open", { createdAt: Date.parse("2026-10-19T15:30:00Z") }), // 23:30 Manila, Oct 19
      row("just-after-midnight", { createdAt: Date.parse("2026-10-19T16:05:00Z") }), // 00:05 Manila, Oct 20
    ];
    expect(onlineOpenToday(rows, NOW).map((r) => r.id)).toEqual(["made-yesterday-for-today", "just-after-midnight"]);
  });

  it("TC-QUEUE-NEG-04 all finished → 0 (badge hidden)", () => {
    expect(onlineOpenToday([row("a", { status: "done" }), row("b", { status: "done" }), row("c", { status: "declined" })], NOW)).toHaveLength(0);
  });
});
