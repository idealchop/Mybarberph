# Test plan and execution log

River AI Rules 04-test: Create → Apply → Execute. Case IDs are `TC-{DOMAIN}-{CAT}-{nn}` (HP happy path, NEG negative/authz, ODD edge, NF not found / non-functional). Every case is **applied** as a runnable test and has a **Result**.

## How to run

```bash
export PATH=$HOME/.local/node22/bin:$PATH
npm run typecheck && npm run lint
npm test                                                     # unit + API contract (Vitest)
CHROME_PATH=/opt/google/chrome/chrome npm run test:e2e       # E2E against DEV (read-only; never PROD)
```

API contract tests call the real route handlers with the Firebase Admin SDK mocked (`tests/api/*`), so tenant, authz, validation and error codes are tested without touching any database. E2E specs only read pages and public/unauthenticated APIs on DEV; they create no data.

## Coverage by area

| Area | HP | NEG | ODD | NF | Where |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Auth + tenant wall (owner, barber, partner, webhook, cron) | ✅ | ✅ | ✅ | ✅ | `tests/api/*` |
| Booking (public, partner, owner) | ✅ | ✅ | ✅ | ✅ | `tests/api/*`, `tests/e2e/*` |
| Payments split Cash / GCash / Other | ✅ | ✅ | ✅ | — (pure function, no lookup) | `tests/unit/pay-split.test.ts` |
| Queue "Done today" date filter | ✅ | ✅ | ✅ | — (pure function, no lookup) | `tests/unit/done-range.test.ts` |
| Plans + limits, hours, formats, ticket codes, legal | ✅ | ✅ | ✅ | ✅ (legal) | `tests/unit/*` |
| Architecture (FE/BE law: no client Firestore SDK, Admin SDK server-only) | ✅ | ✅ | — | — | `tests/unit/architecture-contract.test.ts` |
| Security (headers, SSRF guard, cron secret) | ✅ | ✅ | — | ✅ | `tests/api/public-and-partner-routes.test.ts`, `tests/e2e/platform.spec.ts` |
| SEO / a11y (noindex, robots, one h1) | ✅ | — | ✅ | ✅ | `tests/e2e/*` |

## Execution log — River AI Rules 1.0.1 pass — 2026-10-19

Run on the box, 2026-10-19 19:54–20:25 Asia/Manila (PHT). Unit + API + architecture: **62 / 62 PASS** (Vitest 3.2.7, Node 22). E2E on DEV: **14 PASS, 10 BLOCKED** (5 cases × 2 viewports). The blocked cases test changes made in this pass, which aren't on DEV yet because the DEV deploy is blocked (expired Firebase/gcloud login). Dev answered with the old behaviour (for example `404 {"error":"Booking not found"}` without `code`), which is what we'd expect before the deploy.

| Case ID | Case | Layer | Applied as | Env | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-CRON-NEG-01 | a wrong or missing secret is 401 and runs nothing | API contract (route handler, mocked Admin SDK) | `tests/api/cron.test.ts` | local | PASS |
| TC-CRON-HP-01 | the right secret (Bearer or x-companion-cron) runs the tips | API contract (route handler, mocked Admin SDK) | `tests/api/cron.test.ts` | local | PASS |
| TC-STATE-HP-02 | a saved key is returned by GET /api/shop for the same owner only | API contract (route handler, mocked Admin SDK) | `tests/api/owner-routes.test.ts` | local | PASS |
| TC-AUTH-NEG-01 | GET /api/shop without a token is 401 unauthenticated | API contract (route handler, mocked Admin SDK) | `tests/api/owner-routes.test.ts` | local | PASS |
| TC-AUTH-NEG-02 | an invalid ID token is 401 and touches no data | API contract (route handler, mocked Admin SDK) | `tests/api/owner-routes.test.ts` | local | PASS |
| TC-SHOP-HP-01 | GET /api/shop returns the caller's own shop | API contract (route handler, mocked Admin SDK) | `tests/api/owner-routes.test.ts` | local | PASS |
| TC-STATE-HP-01 | saves a known key for the signed-in owner | API contract (route handler, mocked Admin SDK) | `tests/api/owner-routes.test.ts` | local | PASS |
| TC-TENANT-NEG-01 | a shopId in the body cannot redirect the write to another shop | API contract (route handler, mocked Admin SDK) | `tests/api/owner-routes.test.ts` | local | PASS |
| TC-STATE-NEG-01 | unknown key is 400 bad_request | API contract (route handler, mocked Admin SDK) | `tests/api/owner-routes.test.ts` | local | PASS |
| TC-STATE-NEG-02 | value must be a JSON string | API contract (route handler, mocked Admin SDK) | `tests/api/owner-routes.test.ts` | local | PASS |
| TC-SEC-NF-01 | every response carries the baseline security headers | API contract (route handler, mocked Admin SDK) | `tests/api/platform-config.test.ts` | local | PASS |
| TC-SEO-NF-01 | robots: dev blocks everything | API contract (route handler, mocked Admin SDK) | `tests/api/platform-config.test.ts` | local | PASS |
| TC-SEO-NF-02 | robots: prod blocks only the API | API contract (route handler, mocked Admin SDK) | `tests/api/platform-config.test.ts` | local | PASS |
| TC-BILL-NEG-01 | not configured → 503, nothing written | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-BILL-NEG-02 | bad signature → 401, nothing written | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-BILL-HP-01 | valid signature activates the plan and writes an audit entry | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-BILL-ODD-01 | a signed event for an unknown plan changes nothing | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-BOOK-NEG-01 | POST /api/public/bookings without shopId is 400 | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-BOOK-ODD-01 | a non-JSON body is 400, not a crash | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-BARBER-NEG-01 | an expired/unknown barber link is 404 | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-BARBER-NEG-02 | a barber link cannot write owner-only keys | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-BARBER-HP-01 | a live barber link writes to its own shop only | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-RIVER-NEG-01 | not configured → 503 | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-RIVER-NEG-02 | missing or wrong key → 401 | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-RIVER-HP-01 | correct key (header or Bearer) passes | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-SEC-NEG-01 | rejects a host outside the allowlist without fetching it | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-SEC-NEG-02 | rejects an allowed host that redirects to a disallowed one | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-SEC-HP-02 | proxies an image from an allowed host | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-ARCH-NEG-01 | no source file imports the Firestore or Storage client SDK | Architecture contract (source scan) | `tests/unit/architecture-contract.test.ts` | local | PASS |
| TC-ARCH-NEG-02 | the Admin SDK is imported only by server code | Architecture contract (source scan) | `tests/unit/architecture-contract.test.ts` | local | PASS |
| TC-ARCH-HP-01 | every server module is marked server-only | Architecture contract (source scan) | `tests/unit/architecture-contract.test.ts` | local | PASS |
| TC-ARCH-NEG-03 | client code never imports server modules | Architecture contract (source scan) | `tests/unit/architecture-contract.test.ts` | local | PASS |
| TC-BOOK-HP-01 | accepts a Philippine mobile in common formats | Unit | `tests/unit/contact-and-legal.test.ts` | local | PASS |
| TC-BOOK-HP-02 | accepts and lower-cases an email | Unit | `tests/unit/contact-and-legal.test.ts` | local | PASS |
| TC-BOOK-NEG-02 | rejects empty, malformed and non-mobile values | Unit | `tests/unit/contact-and-legal.test.ts` | local | PASS |
| TC-LEGAL-NF-02 | security: escapes markup other than <b> | Unit | `tests/unit/contact-and-legal.test.ts` | local | PASS |
| TC-LEGAL-HP-01 | today's legal copy renders unchanged | Unit | `tests/unit/contact-and-legal.test.ts` | local | PASS |
| TC-QUEUE-HP-01 | default Today shows only visits finished since Manila midnight | Unit | `tests/unit/done-range.test.ts` | local | PASS |
| TC-QUEUE-ODD-01 | a cut at 23:30 Manila yesterday (15:30Z) is not today; 00:10 Manila today (16:10Z) is | Unit | `tests/unit/done-range.test.ts` | local | PASS |
| TC-QUEUE-HP-02 | picking a date shows that day and labels it | Unit | `tests/unit/done-range.test.ts` | local | PASS |
| TC-QUEUE-HP-03 | a range shows every day in it, newest first, with a range label | Unit | `tests/unit/done-range.test.ts` | local | PASS |
| TC-QUEUE-NEG-01 | unfinished visits never appear in the done list | Unit | `tests/unit/done-range.test.ts` | local | PASS |
| TC-FMT-HP-01 | whole pesos have no decimals | Unit | `tests/unit/format-and-hours.test.ts` | local | PASS |
| TC-FMT-ODD-01 | keeps centavos only when present; signed adds + | Unit | `tests/unit/format-and-hours.test.ts` | local | PASS |
| TC-HOURS-HP-01 | the same hours every day read as Everyday | Unit | `tests/unit/format-and-hours.test.ts` | local | PASS |
| TC-HOURS-ODD-01 | no open day reads as Closed | Unit | `tests/unit/format-and-hours.test.ts` | local | PASS |
| TC-HOURS-NEG-01 | parseWeek rejects non-objects and repairs invalid times | Unit | `tests/unit/format-and-hours.test.ts` | local | PASS |
| TC-PAY-HP-01 | splits paid visits into Cash and GCash from the stored method | Unit | `tests/unit/pay-split.test.ts` | local | PASS |
| TC-PAY-ODD-01 | a paid visit with no stored method is Other, never guessed as cash | Unit | `tests/unit/pay-split.test.ts` | local | PASS |
| TC-PAY-NEG-01 | unpaid visits are not collected and have no method label | Unit | `tests/unit/pay-split.test.ts` | local | PASS |
| TC-PAY-HP-02 | the sales report's collected total equals the sum of its split | Unit | `tests/unit/pay-split.test.ts` | local | PASS |
| TC-PAY-ODD-02 | per barber: split by method, remit = cash + no-method (server rule), online excluded | Unit | `tests/unit/pay-split.test.ts` | local | PASS |
| TC-PLAN-HP-01 | known plans map to their tier and limits | Unit | `tests/unit/plans.test.ts` | local | PASS |
| TC-PLAN-ODD-01 | legacy plan ids still resolve | Unit | `tests/unit/plans.test.ts` | local | PASS |
| TC-PLAN-NEG-01 | unknown, empty or null plans fall back to Partner | Unit | `tests/unit/plans.test.ts` | local | PASS |
| TC-PLAN-ODD-02 | cheapest plan for a shop count (boundaries 1, 5, 6) | Unit | `tests/unit/plans.test.ts` | local | PASS |
| TC-PLAN-HP-02 | plan limits off (test phase) entitles every shop to all features | Unit | `tests/unit/plans.test.ts` | local | PASS |
| TC-PLAN-HP-03 | plan limits on uses the stored plan | Unit | `tests/unit/plans.test.ts` | local | PASS |
| TC-SCAN-HP-01 | reads the code from a ticket URL | Unit | `tests/unit/ticket-code.test.ts` | local | PASS |
| TC-SCAN-HP-02 | reads a bare code inside other text | Unit | `tests/unit/ticket-code.test.ts` | local | PASS |
| TC-SCAN-ODD-01 | accepts older two-letter refs | Unit | `tests/unit/ticket-code.test.ts` | local | PASS |
| TC-SCAN-NEG-01 | returns the trimmed, upper-cased input when nothing matches | Unit | `tests/unit/ticket-code.test.ts` | local | PASS |
| TC-HOME-HP-01 | Given a guest, when they open /, then Home renders with a sign-in entry and no errors | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | BLOCKED: fails on the build now on DEV (deployed before this pass): h1 on Home added in c5c45aa. Re-run after the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-SEO-NF-03 | Given the app shell, then it is not indexable | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-HOME-HP-01 | Given a guest, when they open /, then Home renders with a sign-in entry and no errors | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | BLOCKED: fails on the build now on DEV (deployed before this pass): h1 on Home added in c5c45aa. Re-run after the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-SEO-NF-03 | Given the app shell, then it is not indexable | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-LEGAL-HP-02 | /terms has a title, a description and one h1 | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-LEGAL-ODD-02 | /terms stays noindex while it is marked as a draft | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-LEGAL-HP-02 | /privacy has a title, a description and one h1 | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-LEGAL-ODD-02 | /privacy stays noindex while it is marked as a draft | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-LEGAL-HP-02 | /terms has a title, a description and one h1 | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-LEGAL-ODD-02 | /terms stays noindex while it is marked as a draft | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-LEGAL-HP-02 | /privacy has a title, a description and one h1 | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-LEGAL-ODD-02 | /privacy stays noindex while it is marked as a draft | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-BOOK-NF-03 | Given an unknown shop code, when a customer opens /book, then they see Shop not found | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-BARBER-NF-03 | Given an invalid barber link, then the barber sees that the link is not active | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-BOOK-NF-03 | Given an unknown shop code, when a customer opens /book, then they see Shop not found | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-BARBER-NF-03 | Given an invalid barber link, then the barber sees that the link is not active | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-SEC-HP-01 | Every page response carries the security headers | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | BLOCKED: fails on the build now on DEV (deployed before this pass): security headers added in c1e65ab. Re-run after the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-AUTH-NEG-03 | Owner API without a token is 401 with a machine-readable code | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | BLOCKED: fails on the build now on DEV (deployed before this pass): error `code` added in c1e65ab/0a50c19. Re-run after the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-BOOK-NEG-03 | An unknown public booking is 404 with code not_found | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | BLOCKED: fails on the build now on DEV (deployed before this pass): DEV returns 404 correctly; `code` field added in c1e65ab. Re-run after the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-SEO-HP-02 | robots.txt on DEV blocks all crawling | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | BLOCKED: fails on the build now on DEV (deployed before this pass): robots.ts added in 65eb98b. Re-run after the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-SEC-HP-01 | Every page response carries the security headers | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | BLOCKED: fails on the build now on DEV (deployed before this pass): security headers added in c1e65ab. Re-run after the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-AUTH-NEG-03 | Owner API without a token is 401 with a machine-readable code | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | BLOCKED: fails on the build now on DEV (deployed before this pass): error `code` added in c1e65ab/0a50c19. Re-run after the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-BOOK-NEG-03 | An unknown public booking is 404 with code not_found | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | BLOCKED: fails on the build now on DEV (deployed before this pass): DEV returns 404 correctly; `code` field added in c1e65ab. Re-run after the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-SEO-HP-02 | robots.txt on DEV blocks all crawling | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | BLOCKED: fails on the build now on DEV (deployed before this pass): robots.ts added in 65eb98b. Re-run after the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-PAY-HP-03 | Sales Overview Collected card shows Cash ₱X / GCash ₱Y lines; Collection tab shows the split in totals and per barber; History rows show "Paid · Cash/GCash/Other" | Manual (visual) | This doc, section "Manual checks" | DEV | BLOCKED — needs the DEV deploy (owner: Jimboy re-login, then agent) |
| TC-QUEUE-HP-04 | Queue on Oct 19 shows only today's finished visits under "Done today"; picking Oct 17 in the date chip shows "Done · Oct 17" and that day's visits | Manual (visual) | This doc, section "Manual checks" | DEV | BLOCKED — needs the DEV deploy |
| TC-BILL-HP-02 | PayMongo checkout opens, pays in test mode, and the webhook upgrades the plan | Manual | This doc, section "Manual checks" | DEV | BLOCKED — PayMongo test keys aren't in the committed DEV config (owner: Jimboy) |
| TC-AUTH-HP-02 | Sign in with Google and with a Firebase test phone number on DEV | Manual | This doc, section "Manual checks" | DEV | BLOCKED — needs the DEV deploy; sign-in itself unchanged in this pass |

Open FAIL: **none**. Skipped automated tests: `TC-SEO-HP-02` skips itself on non-DEV hosts (`test.skip` with reason "DEV-only expectation"); on DEV it runs.

## Manual checks (after the DEV deploy)

1. **Pay split** — sign in as a test owner with paid visits: Sales → Overview, the Collected card shows `Cash ₱…` and `GCash ₱…` lines (Online / Other only when there are any). Sales → Collection: Collected card with the split, each barber row shows the split. History: each paid row shows `Paid · Cash`, `Paid · GCash` or `Paid · Other`.
2. **Done today** — Queue: the "Done today" header lists only visits finished since midnight Manila. Tap the calendar chip, pick an earlier day: label becomes `Done · <date>`, list shows that day. Today chip returns to the default. Check at 320 px that the chips wrap under the label.
3. **Sign-in** — Google popup (desktop) and redirect (mobile), and a Firebase test phone number with `bp.authTest=1`.
4. **Checkout** — only when PayMongo test keys are configured on DEV.

Record date, env and result here when run.
