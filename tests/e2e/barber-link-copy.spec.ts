import { expect, test, type Page } from "@playwright/test";
import { expectNamedControls } from "./helpers";

const local = (url: string | undefined) => Boolean(url && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url));
test.skip(({ baseURL }) => !local(baseURL), "local app only");
test.use({ viewport: { width: 390, height: 844 } });

const TOKEN = "example-only";

function chair(id: string, name: string, token?: string) {
  return { id, number: 1, label: name, barberId: `b-${id}`, barberName: name, ...(token ? { linkToken: token } : {}), active: true, locationId: "home" };
}

function fixture(chairs: ReturnType<typeof chair>[]) {
  return {
    shopId: "fixture-shop",
    chairId: null,
    shop: { id: "fixture-shop", name: "Fixture shop", address: "", area: "", phone: "", location: null, photoUrls: [], logoUrl: null, plan: "lifetime_unlimited", services: [] },
    values: {
      "barbers.shop-profile": JSON.stringify({ name: "Fixture shop", address: "", phone: "", area: "", about: "", location: null, photoUrls: [], logoUrl: "", locations: 1, hours: "" }),
      "barbers.shop-locations": JSON.stringify({
        enabled: true, viewId: "home",
        branches: [{ id: "home", name: "San Antonio", area: "San Antonio, San Pedro", address: "San Antonio, San Pedro", phone: "", about: "", location: null, photoUrls: [] }],
      }),
      "barbers.shop-chairs": JSON.stringify(chairs),
    },
    bookings: [],
  };
}

async function boot(page: Page, chairs: ReturnType<typeof chair>[], clipboard: "ok" | "deny" | "missing") {
  await page.addInitScript(({ raw, clipboard: mode }) => {
    sessionStorage.setItem("bp.ownerFixture", raw);
    const writes: string[] = [];
    (window as unknown as { __writes: string[]; __shared: number }).__writes = writes;
    (window as unknown as { __shared: number }).__shared = 0;
    const writeText = (text: string) => {
      if (mode === "deny") return Promise.reject(new Error("denied"));
      writes.push(text);
      return Promise.resolve();
    };
    const clip = mode === "missing" ? undefined : { writeText };
    try { Object.defineProperty(navigator, "clipboard", { configurable: true, get: () => clip }); } catch { /* already sealed */ }
    try { Object.defineProperty(navigator, "share", { configurable: true, value: () => { (window as unknown as { __shared: number }).__shared += 1; return Promise.resolve(); } }); } catch { /* already sealed */ }
  }, { raw: JSON.stringify(fixture(chairs)), clipboard });
  await page.route("**/sw.js*", (route) => route.abort());
  await page.route("**/api/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/settings/shops", { waitUntil: "domcontentloaded" });
}

const share = (page: Page, name: string) => page.locator("li").filter({ hasText: name }).filter({ hasNot: page.locator("ul") }).getByRole("button", { name: "Share to Barber" });
const writes = (page: Page) => page.evaluate(() => (window as unknown as { __writes: string[] }).__writes);
const shared = (page: Page) => page.evaluate(() => (window as unknown as { __shared: number }).__shared);

test("TC-COPY-UI-01 Share copies the URL only, and Copy link repeats that same URL", async ({ page }) => {
  await boot(page, [chair("c-jusfter", "Jusfter", TOKEN), chair("c-jayless", "Jayless", "example-jay"), chair("c-keith", "Keith Abante", "example-keith")], "ok");
  await share(page, "Jusfter").click();
  const dialog = page.getByRole("dialog", { name: "Link copied" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Jusfter", { exact: true })).toBeVisible();
  const url = `http://127.0.0.1:3300/b/${TOKEN}`;
  await expect(dialog.getByText(url)).toBeVisible();
  expect(await writes(page)).toEqual([url]);
  expect(await shared(page)).toBe(0);
  await expect(page.locator("input:focus, textarea:focus")).toHaveCount(0);
  await expect(dialog.locator("input, textarea")).toHaveCount(0);
  await expect(dialog).not.toContainText(/chair/i);
  await page.screenshot({ path: "/opt/cursor/artifacts/built-barber-link-copied-sheet.png" });
  await dialog.getByRole("button", { name: "Copy link" }).click();
  expect(await writes(page)).toEqual([url, url]);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toHaveCount(0);
  await share(page, "Jusfter").click();
  await expect(page.getByRole("dialog", { name: "Link copied" })).toBeVisible();
  expect(await writes(page)).toEqual([url, url, url]);
  expect(await shared(page)).toBe(0);
});

test("TC-COPY-UI-02 a denied clipboard shows the manual panel and does not say the link was copied", async ({ page }) => {
  await boot(page, [chair("c-jusfter", "Jusfter", TOKEN)], "deny");
  await share(page, "Jusfter").click();
  const dialog = page.getByRole("dialog", { name: "Barber link" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Copy this link")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Link copied" })).toHaveCount(0);
  await expect(dialog.getByText("The clipboard isn’t available, so nothing was copied.")).toBeVisible();
  await expect(dialog.getByText(`http://127.0.0.1:3300/b/${TOKEN}`)).toBeVisible();
  expect(await writes(page)).toEqual([]);
  await expect(page.locator("input:focus, textarea:focus")).toHaveCount(0);
  const url = dialog.getByText(`http://127.0.0.1:3300/b/${TOKEN}`);
  await expect(url).toHaveCSS("word-break", "break-all");
  await expectNamedControls(page);
  await page.screenshot({ path: "/opt/cursor/artifacts/built-barber-link-manual-copy-sheet.png" });
  await page.evaluate(() => {
    const writes: string[] = (window as unknown as { __writes: string[] }).__writes;
    Object.defineProperty(navigator, "clipboard", { configurable: true, get: () => ({ writeText: (text: string) => { writes.push(text); return Promise.resolve(); } }) });
  });
  await dialog.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("dialog", { name: "Link copied" })).toBeVisible();
  expect(await writes(page)).toEqual([`http://127.0.0.1:3300/b/${TOKEN}`]);
});

test("TC-COPY-UI-03 a missing clipboard is the same manual panel", async ({ page }) => {
  await boot(page, [chair("c-jusfter", "Jusfter", TOKEN)], "missing");
  await share(page, "Jusfter").click();
  await expect(page.getByRole("dialog", { name: "Barber link" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Link copied" })).toHaveCount(0);
  expect(await shared(page)).toBe(0);
});

test("TC-COPY-UI-04 the first share creates one token and the next share reuses it", async ({ page }) => {
  await boot(page, [chair("c-jusfter", "Jusfter")], "ok");
  await share(page, "Jusfter").click();
  const dialog = page.getByRole("dialog", { name: "Link copied" });
  await expect(dialog).toBeVisible();
  const first = (await writes(page))[0] ?? "";
  expect(first).toMatch(/^http:\/\/127\.0\.0\.1:3300\/b\/[a-z0-9]{12}$/);
  expect(first).not.toContain("Jusfter");
  await dialog.getByRole("button", { name: "Done" }).click();
  await share(page, "Jusfter").click();
  const again = await writes(page);
  expect(again).toEqual([first, first]);
});

test("TC-COPY-UI-05 Back closes the panel", async ({ page }) => {
  await boot(page, [chair("c-jusfter", "Jusfter", TOKEN)], "ok");
  await share(page, "Jusfter").click();
  await page.getByRole("dialog", { name: "Link copied" }).getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
