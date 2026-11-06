import { expect, test, type Page, type Route } from "@playwright/test";
import { expectNamedControls, expectNoHorizontalOverflow } from "./helpers";

/**
 * Isolated browser checks for the barber-link recovery screens on this branch.
 * Skipped unless E2E_BASE_URL is this machine. /api/barber is answered in the browser,
 * so nothing is written to DEV or prod. A token that fails the pattern is passed through
 * to the local server, which rejects it before any database call.
 */
const local = (url: string | undefined) => Boolean(url && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url));
test.skip(({ baseURL }) => !local(baseURL), "local app only — hosted DEV cannot show this branch");
test.use({ viewport: { width: 390, height: 844 } });

const TOKEN_A = "fixturetokena1";
const TOKEN_B = "fixturetokenb2";

function shopBody(token: string, shopName: string, barberName: string, customer: string | null) {
  const chair = { id: `c-${token}`, number: 1, label: barberName, barberId: `b-${token}`, barberName, linkToken: token, active: true };
  const profile = { name: shopName, address: "", phone: "", area: "", about: "", location: null, photoUrls: [], logoUrl: "", locations: 1, hours: "" };
  const bookings = customer
    ? [{ id: `v-${token}`, shopId: `shop-${token}`, status: "requested", channel: "online", customerLabel: customer, serviceName: "Haircut", ref: "BK-FIXTURE", createdAt: 1, updatedAt: 1, price: 0, slotLabel: "Now", contact: "" }]
    : [];
  return {
    shopId: `shop-${token}`,
    chairId: chair.id,
    shop: { id: `shop-${token}`, name: shopName, plan: "pro_499", address: "", area: "", phone: "", services: [] },
    values: {
      "barbers.shop-profile": JSON.stringify(profile),
      "barbers.shop-chairs": JSON.stringify([chair]),
      "barbers.shop-menu": JSON.stringify({ haircut: { name: "Haircut", durationMins: 30, icon: "clipper" }, treatments: [] }),
      "barbers.shop-locations": JSON.stringify({ enabled: false, viewId: "home", branches: [] }),
    },
    bookings,
  };
}

/** How the next GET /api/barber/:token (the document, not the manifest) should answer. */
type Answer = "ok" | "404" | "500" | "hang" | "wait" | "drop";

async function installApi(page: Page, answer: (token: string, hit: number) => Answer, startOffline = false) {
  const hits = new Map<string, number>();
  const gates = new Map<string, Array<() => void>>();
  await page.addInitScript((offline: boolean) => {
    let on = !offline;
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => on });
    (window as unknown as { __setOnline?: (v: boolean) => void }).__setOnline = (v: boolean) => {
      on = v;
      window.dispatchEvent(new Event(v ? "online" : "offline"));
    };
  }, startOffline);
  await page.route("**/sw.js*", (route) => route.abort());
  await page.route("**/api/barber/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const token = url.pathname.split("/")[3] ?? "";
    if (!/^[a-z0-9]{8,40}$/.test(token)) {
      await route.continue();
      return;
    }
    if (url.pathname.endsWith("/manifest")) {
      await route.fulfill({ status: 200, contentType: "application/manifest+json", body: "{}" });
      return;
    }
    if (route.request().method() !== "GET" || url.pathname.split("/").length !== 4) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "This link was replaced or turned off.", code: "not_found" }) });
      return;
    }
    const n = (hits.get(token) ?? 0) + 1;
    hits.set(token, n);
    const kind = answer(token, n);
    if (kind === "wait") {
      await new Promise<void>((resolve) => {
        const list = gates.get(token) ?? [];
        list.push(resolve);
        gates.set(token, list);
      });
    } else if (kind === "hang") {
      await new Promise((resolve) => setTimeout(resolve, 20_000));
    } else if (kind === "drop") {
      await route.abort();
      return;
    }
    const finish = async () => {
      if (kind === "404") {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "This link was replaced or turned off.", code: "not_found" }) });
        return;
      }
      if (kind === "500" || kind === "hang") {
        await route.fulfill({ status: kind === "hang" ? 504 : 500, contentType: "application/json", body: JSON.stringify({ error: "Unavailable", code: "upstream_error" }) });
        return;
      }
      const south = token === TOKEN_B;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(shopBody(token, south ? "Fixture South" : "Fixture North", south ? "Blair" : "Alex", south ? "South customer" : "North customer")),
      });
    };
    try { await finish(); } catch { /* the page already gave up on a hung request */ }
  });
  return {
    hits: (token: string) => hits.get(token) ?? 0,
    release: (token: string) => { for (const go of gates.get(token) ?? []) go(); gates.set(token, []); },
  };
}

async function setOnline(page: Page, on: boolean) {
  await page.evaluate((value) => (window as unknown as { __setOnline: (v: boolean) => void }).__setOnline(value), on);
}

test("TC-LINK-UI-01 opening, then the working home, with no token on screen", async ({ page }) => {
  const api = await installApi(page, () => "wait");
  await page.goto(`/b/${TOKEN_A}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Opening your link" })).toBeVisible();
  await expect(page.getByText("Checking this link with Barbers.ph.")).toBeVisible();
  await expect(page.getByText("replaced or turned off")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/chair/i);
  await page.screenshot({ path: "/opt/cursor/artifacts/built-barber-link-loading.png" });
  api.release(TOKEN_A);
  await expect(page.getByRole("heading", { name: "Fixture North" })).toBeVisible();
  await expect(page.getByText("North customer")).toBeVisible();
  await expect(page.getByText("South customer")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(TOKEN_A);
  await expectNoHorizontalOverflow(page);
});

test("TC-LINK-UI-02 cold offline stays offline, then Try again opens the link", async ({ page }) => {
  let down = true;
  const api = await installApi(page, () => (down ? "drop" : "ok"), true);
  await page.goto(`/b/${TOKEN_A}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.getByText("replaced or turned off")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/chair/i);
  await page.screenshot({ path: "/opt/cursor/artifacts/built-barber-link-offline.png" });
  await page.setViewportSize({ width: 320, height: 720 });
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const beforeRetry = api.hits(TOKEN_A);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  expect(api.hits(TOKEN_A)).toBeGreaterThan(beforeRetry);
  down = false;
  await setOnline(page, true);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Fixture North" })).toBeVisible();
  expect(api.hits(TOKEN_A)).toBeGreaterThanOrEqual(1);
});

test("TC-LINK-UI-03 a saved copy stays the working home while offline", async ({ page }) => {
  await installApi(page, () => "drop", true);
  const copy = shopBody(TOKEN_A, "Fixture shop", "Alex", null);
  await page.addInitScript((raw) => {
    localStorage.setItem(raw.key, raw.value);
  }, { key: `bp.barber.${TOKEN_A}`, value: JSON.stringify({ shopId: copy.shopId, chairId: copy.chairId, shop: copy.shop, values: copy.values, bookings: [] }) });
  await page.goto(`/b/${TOKEN_A}`, { waitUntil: "domcontentloaded" });
  await setOnline(page, false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status").getByText("Offline, changes will sync")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fixture shop" })).toBeVisible();
  await expect(page.getByText("No one waiting")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your link is open" })).toHaveCount(0);
  await expect(page.getByText("replaced or turned off")).toHaveCount(0);
  await page.screenshot({ path: "/opt/cursor/artifacts/built-barber-link-offline-saved.png" });
});

test("TC-LINK-UI-04 a 500 can be retried into the home", async ({ page }) => {
  const api = await installApi(page, (_token, hit) => (hit === 1 ? "500" : "ok"));
  await page.goto(`/b/${TOKEN_A}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Couldn't open this link" })).toBeVisible();
  await expect(page.getByText("does not mean the link was replaced or turned off")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/chair/i);
  await page.screenshot({ path: "/opt/cursor/artifacts/built-barber-link-unavailable.png" });
  const before = api.hits(TOKEN_A);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Fixture North" })).toBeVisible();
  expect(api.hits(TOKEN_A)).toBe(before + 1);
});

test("TC-LINK-UI-05 a request that never returns shows the same couldn't-open screen", async ({ page }) => {
  test.setTimeout(40_000);
  await installApi(page, () => "hang");
  await page.goto(`/b/${TOKEN_A}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Opening your link" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Couldn't open this link" })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("heading", { name: "This link was replaced or turned off." })).toHaveCount(0);
});

test("TC-LINK-UI-06 a rejected token stays blocked, including after Check again", async ({ page }) => {
  const api = await installApi(page, () => "404");
  await page.goto(`/b/${TOKEN_A}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "This link was replaced or turned off." })).toBeVisible();
  await expect(page.getByText("Fixture North")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/chair/i);
  await page.screenshot({ path: "/opt/cursor/artifacts/built-barber-link-turned-off.png" });
  await expectNamedControls(page);
  const before = api.hits(TOKEN_A);
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByRole("heading", { name: "Opening your link" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This link was replaced or turned off." })).toBeVisible();
  expect(api.hits(TOKEN_A)).toBe(before + 1);
  await expect(page.locator("body")).not.toContainText(TOKEN_A);
});

test("TC-LINK-UI-07 a bad token is rejected locally, and the next token does not keep the first barber", async ({ page }) => {
  const api = await installApi(page, (token) => (token === TOKEN_B ? "wait" : "ok"));
  await page.goto("/b/not-a-real-token", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "This link was replaced or turned off." })).toBeVisible();
  expect(api.hits("not-a-real-token")).toBe(0);

  await page.goto(`/b/${TOKEN_A}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Fixture North" })).toBeVisible();
  await page.evaluate((href) => {
    const a = document.createElement("a");
    a.href = href;
    document.body.appendChild(a);
    a.click();
  }, `/b/${TOKEN_B}`);
  await expect(page.getByRole("heading", { name: "Opening your link" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fixture North" })).toHaveCount(0);
  await expect(page.getByText("North customer")).toHaveCount(0);
  await expect.poll(() => api.hits(TOKEN_B)).toBeGreaterThan(0);
  api.release(TOKEN_B);
  await expect(page.getByRole("heading", { name: "Fixture South" })).toBeVisible();
  await expect(page.getByText("South customer")).toBeVisible();
  await expect(page.getByText("North customer")).toHaveCount(0);
});

test("TC-LINK-UI-08 rapid Try again does not fire a second request", async ({ page }) => {
  const api = await installApi(page, (_token, hit) => (hit === 1 ? "500" : "wait"));
  await page.goto(`/b/${TOKEN_A}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Couldn't open this link" })).toBeVisible();
  const button = page.getByRole("button", { name: "Try again" });
  await button.click();
  await button.click({ timeout: 400 }).catch(() => undefined);
  expect(api.hits(TOKEN_A)).toBe(2);
  api.release(TOKEN_A);
  await expect(page.getByRole("heading", { name: "Fixture North" })).toBeVisible();
});
