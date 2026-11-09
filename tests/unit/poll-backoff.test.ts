import { describe, expect, it } from "vitest";
import { nextPollEvery } from "@/lib/cloud";

describe("live poll backoff", () => {
  it("stays at 15s while the queue is changing and stops at 30s when it is quiet", () => {
    expect(nextPollEvery(15_000, false)).toBe(15_000);
    expect(nextPollEvery(30_000, false)).toBe(15_000);
    expect(nextPollEvery(15_000, true)).toBe(30_000);
    expect(nextPollEvery(30_000, true)).toBe(30_000);
  });
});
