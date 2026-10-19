import { expect, test } from "@playwright/test";

// HTTP-level checks on the deployed DEV backend. No sign-in, no writes.

test.describe("Platform", () => {
  test("TC-SEC-HP-01 Every page response carries the security headers", async ({ request }) => {
    const res = await request.get("/terms");
    expect(res.status()).toBe(200);
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["permissions-policy"]).toContain("microphone=()");
  });

  test("TC-AUTH-NEG-03 Owner API without a token is 401 with a machine-readable code", async ({ request }) => {
    const res = await request.get("/api/shop");
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ code: "unauthenticated" });
  });

  test("TC-BOOK-NEG-03 An unknown public booking is 404 with code not_found", async ({ request }) => {
    const res = await request.get("/api/public/bookings/e2e-missing-booking");
    expect(res.status()).toBe(404);
    expect(await res.json()).toMatchObject({ code: "not_found" });
  });

  test("TC-SEO-HP-02 robots.txt on DEV blocks all crawling", async ({ request, baseURL }) => {
    test.skip(!/barbers-ph-dev|localhost/.test(baseURL ?? ""), "DEV-only expectation");
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/Disallow: \/\s*$/m);
  });
});
