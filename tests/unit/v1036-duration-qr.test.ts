import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { haircutMinutesLabel } from "@/lib/visit-minutes";

const t = Date.parse("2026-10-31T12:00:00+08:00");
describe("v1.0.36 Records duration subtext", () => {
  it("started → finished minutes, singular/plural", () => {
    expect(haircutMinutesLabel({ startedAt: t, completedAt: t + 25 * 60000 })).toBe("25 mins");
    expect(haircutMinutesLabel({ startedAt: t, completedAt: t + 50000 })).toBe("1 min");
  });
  it("nothing when unknown or owner-added", () => {
    expect(haircutMinutesLabel({ completedAt: t })).toBe("");
    expect(haircutMinutesLabel({ startedAt: t, completedAt: t })).toBe("");
    expect(haircutMinutesLabel({ startedAt: t, completedAt: t + 600000, source: "manual" })).toBe("");
  });
});
describe("v1.0.36 QR page fits a phone", () => {
  it("cards and buttons can shrink; link truncates; QR scales", () => {
    const src = readFileSync("src/components/qr/qr-screen.tsx", "utf8");
    expect(src).toContain("grid-cols-1");
    expect(src).toContain("[&>*]:min-w-0");
    expect(src).toContain("text-ellipsis whitespace-nowrap");
    expect(src).toContain("[&_svg]:w-full");
    expect(src).toContain("writeText(t.url)");
  });
});
