import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./helpers";

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
    const res = await request.get("/api/public/bookings/e2e-missing-booking?shop=e2e-missing-shop");
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

test.describe("Install app and updates (PWA)", () => {
  test("TC-PWA-HP-03 owner manifest is valid and opens /home", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m).toMatchObject({ start_url: "/home", scope: "/", display: "standalone" });
    for (const icon of m.icons as { src: string }[]) expect((await request.get(icon.src)).status()).toBe(200);
    expect((m.icons as { purpose: string }[]).some((i) => i.purpose === "maskable")).toBe(true);
  });

  test("TC-PWA-HP-04 a barber link page links its own per-token manifest; unknown tokens get none", async ({ page, request }) => {
    await page.goto("/b/e2e-not-a-real-token", { waitUntil: "domcontentloaded" });
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/api/barber/e2e-not-a-real-token/manifest");
    expect((await request.get("/api/barber/e2e-not-a-real-token/manifest")).status()).toBe(404);
  });

  test("TC-PWA-HP-05 the service worker registers and /api/version answers", async ({ page, request }) => {
    expect(await (await request.get("/api/version")).json()).toHaveProperty("build");
    await page.goto("/home", { waitUntil: "load" });
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe("/");
  });

  test("TC-PWA-HP-06 Settings › Install app renders the install screen without overflow", async ({ page }) => {
    await page.goto("/settings/install", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Install Barbers\.ph|Installed!/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Install the app" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Barbers.ph app icon" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
