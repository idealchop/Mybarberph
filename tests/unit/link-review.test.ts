import { describe, expect, it } from "vitest";
import { LINK_REVIEW_MONTHS, linkReviewDue, reviewFrom } from "@/lib/shop-chairs";

const NOW = Date.parse("2026-10-19T02:00:00Z");

describe("Barber link review (every 6 months, nudge only)", () => {
  it("TC-LINK-HP-01 the next review is 6 months after confirming", () => {
    expect(LINK_REVIEW_MONTHS).toBe(6);
    const next = new Date(reviewFrom(NOW));
    expect(next.getUTCFullYear()).toBe(2027);
    expect(next.getUTCMonth()).toBe(3); // Oct → Apr
  });
  it("TC-LINK-ODD-01 due only once the review date has passed", () => {
    expect(linkReviewDue({ linkToken: "abc12345", linkReviewAt: NOW - 1 }, NOW)).toBe(true);
    expect(linkReviewDue({ linkToken: "abc12345", linkReviewAt: NOW + 86_400_000 }, NOW)).toBe(false);
  });
  it("TC-LINK-NEG-02 no prompt for a deactivated barber or a chair with no link yet", () => {
    expect(linkReviewDue({ linkToken: "abc12345", linkReviewAt: NOW - 1, active: false }, NOW)).toBe(false);
    expect(linkReviewDue({ linkReviewAt: NOW - 1 }, NOW)).toBe(false);
  });
});
