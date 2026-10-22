import { describe, expect, it } from "vitest";
import { visitMinutes } from "@/lib/visit-minutes";
describe("visitMinutes", () => {
  it("start → done", () => expect(visitMinutes({ startedAt: 60000, createdAt: 0, completedAt: 26 * 60000 })).toBe(25));
  it("falls back to created", () => expect(visitMinutes({ createdAt: 60000, completedAt: 41 * 60000 })).toBe(40));
  it("unknown", () => expect(visitMinutes({ createdAt: 0 })).toBeNull());
});
