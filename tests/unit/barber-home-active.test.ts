import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { showWaitingAndHistory } from "@/lib/barber-home";

describe("barber home hides Waiting + History while a haircut is active (v1.0.28)", () => {
  it("toggles on the live current row", () => {
    expect(showWaitingAndHistory(undefined)).toBe(true);
    expect(showWaitingAndHistory({ status: "in_chair" })).toBe(false);
    // realtime update: Complete or cancel flips the row out of in_chair → shown again
    expect(showWaitingAndHistory({ status: "done" })).toBe(true);
    expect(showWaitingAndHistory({ status: "cancelled" })).toBe(true);
  });
  it("screen wraps Waiting and History in the guard and keeps the footer outside", () => {
    const s = readFileSync("src/features/barber/barber-link-screen.tsx", "utf8");
    const g = s.indexOf("showWaitingAndHistory(current) ? (");
    const end = s.indexOf("</>) : null}", g);
    const block = s.slice(g, end);
    expect(g).toBeGreaterThan(0);
    expect(block).toContain(">Waiting</h2>");
    expect(block).toContain("setHistory(true)");
    expect(block).not.toContain("<PoweredBy");
    expect(s.slice(end)).toContain("<PoweredBy");
  });
});
