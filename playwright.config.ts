import { defineConfig } from "@playwright/test";

/**
 * Read-only end-to-end checks. They never sign in and never write data, so they
 * are safe to run against hosted DEV after every deploy:
 *   npm run test:e2e                       # defaults to DEV
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e
 * Never point E2E_BASE_URL at production.
 * CHROME_PATH lets the suite use a system Chrome instead of a downloaded browser.
 */
const baseURL = process.env.E2E_BASE_URL || "https://barbers-ph-dev--mybarberph.asia-southeast1.hosted.app";
const executablePath = process.env.CHROME_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL, launchOptions: { executablePath } },
  projects: [
    { name: "mobile-320", use: { viewport: { width: 320, height: 720 }, isMobile: false } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
