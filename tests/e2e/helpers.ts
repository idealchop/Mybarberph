import { expect, type Page } from "@playwright/test";

/** Open a page and wait for client rendering (pages poll, so never wait for network idle). */
export async function open(page: Page, path: string, ready: string | RegExp) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(ready).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
}

/** One h1 and a main landmark (a11y heading hierarchy). */
export async function expectLandmarks(page: Page) {
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
}

/** Nothing scrolls sideways (320px minimum width). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Every button and link has an accessible name. */
export async function expectNamedControls(page: Page) {
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll("button, a[href], [role=button]")]
      .filter((el) => {
        const html = el as HTMLElement;
        if (html.offsetParent === null && getComputedStyle(html).position !== "fixed") return false;
        const label = el.getAttribute("aria-label") || el.getAttribute("title") || html.innerText?.trim()
          || el.querySelector("img[alt]:not([alt=''])")?.getAttribute("alt");
        const labelledBy = el.getAttribute("aria-labelledby");
        return !label && !labelledBy;
      })
      .map((el) => el.outerHTML.slice(0, 120)),
  );
  expect(unnamed).toEqual([]);
}
