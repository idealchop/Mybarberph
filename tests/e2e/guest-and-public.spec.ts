import { expect, test } from "@playwright/test";
import { expectLandmarks, expectNamedControls, expectNoHorizontalOverflow, open } from "./helpers";

// Read-only BDD checks for guests and public links. IDs follow TC-{DOMAIN}-{CAT}-{nn}
// and are listed in docs/testing/test-plan.md.

test.describe("Guest owner app", () => {
  test("TC-HOME-HP-01 Given a guest, when they open /, then Home renders with a sign-in entry and no errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, "/", "Sign in");
    await expect(page).toHaveURL(/\/home$/);
    await expect(page).toHaveTitle(/Home · Barbers\.ph/);
    await expectLandmarks(page);
    await expectNoHorizontalOverflow(page);
    await expectNamedControls(page);
    expect(errors).toEqual([]);
  });

  test("TC-SEO-NF-03 Given the app shell, then it is not indexable", async ({ page }) => {
    await open(page, "/home", "Sign in");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("Legal pages", () => {
  for (const [path, title] of [["/terms", "Terms of Service"], ["/privacy", "Privacy Policy"]] as const) {
    test(`TC-LEGAL-HP-02 ${path} has a title, a description and one h1`, async ({ page }) => {
      await open(page, path, title);
      await expect(page).toHaveTitle(new RegExp(`${title} · Barbers\\.ph`));
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
      await expectLandmarks(page);
      await expect(page.locator("h1")).toHaveText(title);
      await expectNoHorizontalOverflow(page);
      await expectNamedControls(page);
    });

    test(`TC-LEGAL-ODD-02 ${path} stays noindex while it is marked as a draft`, async ({ page }) => {
      await open(page, path, title);
      await expect(page.getByText("Draft for legal review").filter({ visible: true }).first()).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    });
  }
});

test.describe("Public customer and barber links", () => {
  test("TC-BOOK-NF-03 Given an unknown shop code, when a customer opens /book, then they see Shop not found", async ({ page }) => {
    await open(page, "/book?shop=e2e-does-not-exist", "Shop not found");
    await expectLandmarks(page);
    await expectNoHorizontalOverflow(page);
  });

  test("TC-BARBER-NF-03 Given an invalid barber link, then the barber sees that the link was replaced or turned off", async ({ page }) => {
    await open(page, "/b/e2e-not-a-real-token", "This link was replaced or turned off.");
    await expectLandmarks(page);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Sign-in sheet opens once per visit", () => {
  test("TC-AUTH-HP-04 Given a signed-out visitor on Home, then the sign-in sheet opens by itself and can be dismissed", async ({ page }) => {
    await open(page, "/home", "Sign in");
    const sheet = page.getByRole("dialog", { name: "Sign up or log in" });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    // Guest browsing still works after dismissing; the sheet doesn't come back in this visit.
    await page.getByRole("link", { name: /Queue/ }).first().click();
    await expect(page).toHaveURL(/\/queue/);
    await page.waitForTimeout(1500);
    await expect(page.getByRole("dialog", { name: "Sign up or log in" })).toHaveCount(0);
  });

  test("TC-AUTH-NEG-05 Given a guest on Moments, then the sign-in sheet does not open by itself", async ({ page }) => {
    await page.goto("/moments", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await expect(page.getByRole("dialog", { name: "Sign up or log in" })).toHaveCount(0);
  });
});
