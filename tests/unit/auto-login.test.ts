import { describe, expect, it } from "vitest";
import { autoOpensLogin, resetAutoLoginTurn, takeAutoLoginTurn } from "@/lib/auto-login";

describe("Sign-in sheet opens by itself once per visit on dashboard pages", () => {
  it("TC-AUTH-HP-03 dashboard pages auto-open for a signed-out visitor", () => {
    for (const p of ["/home", "/queue", "/queue/new", "/sales", "/history", "/settings", "/settings/services", "/qr", "/home/"]) expect(autoOpensLogin(p)).toBe(true);
  });
  it("TC-AUTH-NEG-04 never on guest pages: booking/schedule, ticket, barber link, Moments, privacy, terms, map credits", () => {
    for (const p of ["/book", "/book?shop=abc", "/b/keithtoken1", "/moments", "/moments/profile", "/privacy", "/terms", "/settings/map-credits", "/ticket/BK-1"]) expect(autoOpensLogin(p)).toBe(false);
    expect(autoOpensLogin("/bookings")).toBe(true); // prefix match is per path segment
  });
  it("TC-AUTH-ODD-01 once per visit: the second chance in the same page load is refused", () => {
    resetAutoLoginTurn();
    expect(takeAutoLoginTurn()).toBe(true);
    expect(takeAutoLoginTurn()).toBe(false);
  });
});
