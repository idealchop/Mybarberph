import { describe, expect, it } from "vitest";
import { defaultManualTime, manilaTime, manualPayError, manualRecord, manualTimeError } from "@/lib/manual-record";
import { dayClaim } from "@/lib/profit-claim";

const NOW = Date.parse("2026-10-26T15:00:00+08:00"); // Mon Oct 26, 3 PM Manila
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);

describe("Manual records from the profit report", () => {
  it("a Manila date + time becomes completedAt on that Manila day (even near midnight)", () => {
    const late = manilaTime("2026-10-20", "23:50")!;
    expect(late).toBe(Date.parse("2026-10-20T15:50:00Z"));
    expect(ymd(late)).toBe("2026-10-20");
    expect(ymd(manilaTime("2026-10-21", "00:05")!)).toBe("2026-10-21");
    expect(manilaTime("2026-02-30", "10:00")).toBeNull();
    expect(manilaTime("2026-10-20", "24:00")).toBeNull();
  });

  it("past days are allowed; future times and > 70 days back are not", () => {
    expect(manualTimeError(manilaTime("2026-10-19", "10:00"), NOW)).toBe("");
    expect(manualTimeError(manilaTime("2026-10-26", "16:00"), NOW)).toContain("hasn't happened");
    expect(manualTimeError(manilaTime("2026-08-01", "10:00"), NOW)).toContain("70 days");
  });

  it("builds a finished walk-in with created/started/completed on the picked time", () => {
    const r = manualRecord({ day: "2026-10-22", time: "14:30", barberId: "glen", barberName: "Glenmar", locationId: "bb1", serviceName: "Haircut", price: 20_000, payMethod: "cash", ref: "AB12", shopId: "s" }, NOW);
    if (!("row" in r) || !r.row) throw new Error("expected a row");
    expect(r.row).toMatchObject({ status: "done", channel: "walk-in", source: "manual", paid: true, payMethod: "cash", barberId: "glen", locationId: "bb1", price: 20_000 });
    expect(r.row.completedAt).toBe(Date.parse("2026-10-22T14:30:00+08:00"));
    expect(r.row.createdAt).toBe(r.row.completedAt);
    const gcash = manualRecord({ day: "2026-10-22", time: "14:30", barberId: "glen", barberName: "G", locationId: "bb1", serviceName: "Haircut", price: 1, payMethod: "gcash", ref: "x", shopId: "s" }, NOW);
    expect("row" in gcash && gcash.row).toMatchObject({ paid: true, payMethod: "gcash" });
    const unpaid = manualRecord({ day: "2026-10-22", time: "14:30", barberId: "glen", barberName: "G", locationId: "bb1", serviceName: "Haircut", price: 1, payMethod: "unpaid" as never, ref: "x", shopId: "s" }, NOW);
    expect("error" in unpaid && unpaid.error).toContain("Cash or GCash");
  });

  it("the server rule rejects unpaid (or method-less) manual records", () => {
    expect(manualPayError({ paid: true, payMethod: "cash" })).toBe("");
    expect(manualPayError({ paid: true, payMethod: "gcash" })).toBe("");
    expect(manualPayError({ paid: false })).not.toBe("");
    expect(manualPayError({ paid: true })).not.toBe("");
    expect(manualPayError({ paid: true, payMethod: "online" })).not.toBe("");
  });

  it("the add form defaults to now on today and noon on a past day", () => {
    expect(defaultManualTime("2026-10-26", NOW)).toBe("15:00");
    expect(defaultManualTime("2026-10-21", NOW)).toBe("12:00");
  });
});

describe("Day claim amounts (same rules as Sales Claiming)", () => {
  const chairs = [{ id: "c1", label: "Chair 1", barberId: "glen", locationId: "bb1", sharePct: 40, shareSet: true }];
  const at = (iso: string) => Date.parse(`${iso}+08:00`);
  const v = (id: string, p: object) => ({ id, status: "done", paid: true, payMethod: "cash", price: 20_000, barberId: "glen", locationId: "bb1", completedAt: at("2026-10-22T10:00:00"), ...p });
  const rows = [
    v("a", {}), v("b", {}), v("c", { payMethod: "gcash" }), v("d", { paid: false }), v("e", { completedAt: at("2026-10-23T00:10:00") }),
    v("f", { locationId: "bb2" }), v("g", {}),
  ];
  it("counts that day's paid visits (cash and GCash, v1.0.25) for that barber and branch, as the owner's share", () => {
    const c = dayClaim(rows, chairs, "glen", "bb1", "2026-10-22", (r) => r.id === "g");
    expect(c.openCount).toBe(3);
    expect(c.openCash).toBe(60_000);
    expect(c.open).toBe(36_000); // 60% owner share
    expect(c.claimed).toBe(12_000);
    expect(c.claimedCount).toBe(1);
  });
  it("no split = all the owner's; the owner's own cuts are never claimed", () => {
    expect(dayClaim(rows, [], "glen", "bb1", "2026-10-22", () => false).open).toBe(80_000); // a, b, c (GCash), g
    expect(dayClaim([v("o", { barberId: "owner" })], chairs, "owner", "bb1", "2026-10-22", () => false)).toMatchObject({ owner: true, open: 0 });
  });
});
