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

Run on the box, 2026-10-19 22:05 Asia/Manila (PHT), DEV build 2b7e328. Unit + API + architecture: **94 / 94 PASS** (Vitest 3.2.7, Node 22). E2E on DEV: **24 PASS, 0 BLOCKED** (5 cases × 2 viewports). All earlier BLOCKED e2e cases now pass on the deployed build (DEV deploy 22:04 PHT; hardened Firestore/Storage rules released 22:05 PHT).

| Case ID | Case | Layer | Applied as | Env | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-BARBER-NEG-05 | a barber can't save a Haircut (₱250) as ₱240: the server saves the menu price | API contract (route handler, mocked Admin SDK) | `tests/api/barber-amount-tip.test.ts` | local | PASS |
| TC-BARBER-HP-04 | several services: the amount is the menu total, whatever the client sent | API contract (route handler, mocked Admin SDK) | `tests/api/barber-amount-tip.test.ts` | local | PASS |
| TC-BARBER-ODD-02 | a home visit keeps its fee on top of the menu price; a visit paid online keeps its paid amount | API contract (route handler, mocked Admin SDK) | `tests/api/barber-amount-tip.test.ts` | local | PASS |
| TC-TIP-HP-01 | a tip is saved as whole pesos in its own field and never changes the amount | API contract (route handler, mocked Admin SDK) | `tests/api/barber-amount-tip.test.ts` | local | PASS |
| TC-TIP-NEG-01 | a negative, zero or non-number tip is dropped | API contract (route handler, mocked Admin SDK) | `tests/api/barber-amount-tip.test.ts` | local | PASS |
| TC-BARBER-HP-05 | the owner can still set a custom amount (owner path, no barber) | API contract (route handler, mocked Admin SDK) | `tests/api/barber-amount-tip.test.ts` | local | PASS |
| TC-BARBER-HP-02 | GET returns only this barber's visits plus open ones waiting at their location | API contract (route handler, mocked Admin SDK) | `tests/api/barber-link-scope.test.ts` | local | PASS |
| TC-BARBER-NEG-03 | PUT on another barber's visit is 404 and nothing is written | API contract (route handler, mocked Admin SDK) | `tests/api/barber-link-scope.test.ts` | local | PASS |
| TC-BARBER-NEG-04 | PUT on a visit at another location, or an unassigned finished one, is 404 | API contract (route handler, mocked Admin SDK) | `tests/api/barber-link-scope.test.ts` | local | PASS |
| TC-BARBER-HP-03 | accepting an open waiting visit stamps this barber; own visits and new walk-ins save | API contract (route handler, mocked Admin SDK) | `tests/api/barber-link-scope.test.ts` | local | PASS |
| TC-BARBER-ODD-01 | rule: barberId wins over a matching chair label | API contract (route handler, mocked Admin SDK) | `tests/api/barber-link-scope.test.ts` | local | PASS |
| TC-LINK-HP-02 | a link with an old expiresAt (monthly expiry) still resolves | API contract (route handler, mocked Admin SDK) | `tests/api/barber-link-scope.test.ts` | local | PASS |
| TC-LINK-NEG-01 | a reset, removed or deactivated link (doc deleted) is 404 with the new text | API contract (route handler, mocked Admin SDK) | `tests/api/barber-link-scope.test.ts` | local | PASS |
| TC-PAY-HP-04 | cash, GCash, online and no-method (Other) are split; remit = cash + Other | API contract (route handler, mocked Admin SDK) | `tests/api/barber-sales.test.ts` | local | PASS |
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
| TC-BARBER-NEG-01 | an unknown, reset or turned-off barber link is 404 | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-BARBER-NEG-02 | a barber link cannot write owner-only keys | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-BARBER-HP-01 | a live barber link writes to its own shop only | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-RIVER-NEG-01 | not configured → 503 | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-RIVER-NEG-02 | missing or wrong key → 401 | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-RIVER-HP-01 | correct key (header or Bearer) passes | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-SEC-NEG-01 | rejects a host outside the allowlist without fetching it | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-SEC-NEG-02 | rejects an allowed host that redirects to a disallowed one | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-SEC-HP-02 | proxies an image from an allowed host | API contract (route handler, mocked Admin SDK) | `tests/api/public-and-partner-routes.test.ts` | local | PASS |
| TC-SALES-HP-01 | San Antonio today: owner Overview = ranking = Keith's link My sales (₱800, 2 cuts) | API contract (route handler, mocked Admin SDK) | `tests/api/sales-consistency.test.ts` | local | PASS |
| TC-SALES-NEG-01 | regression: the San Antonio link no longer adds Keith's Pacita visits (was ₱2,200 / 5 cuts / Cash ₱1,650) | API contract (route handler, mocked Admin SDK) | `tests/api/sales-consistency.test.ts` | local | PASS |
| TC-SALES-NEG-02 | regression: the link's /sales 'mine' row is its own location, not the bigger branch | API contract (route handler, mocked Admin SDK) | `tests/api/sales-consistency.test.ts` | local | PASS |
| TC-SALES-ODD-01 | all locations: owner total = sum of per-location barber rows = sum of both links | API contract (route handler, mocked Admin SDK) | `tests/api/sales-consistency.test.ts` | local | PASS |
| TC-SALES-NEG-03 | regression: a turned-off chair hides only an empty row at that location; sales never drop out of the ranking | API contract (route handler, mocked Admin SDK) | `tests/api/sales-consistency.test.ts` | local | PASS |
| TC-ARCH-NEG-01 | no source file imports the Firestore or Storage client SDK | Architecture contract (source scan) | `tests/unit/architecture-contract.test.ts` | local | PASS |
| TC-ARCH-NEG-02 | the Admin SDK is imported only by server code | Architecture contract (source scan) | `tests/unit/architecture-contract.test.ts` | local | PASS |
| TC-ARCH-HP-01 | every server module is marked server-only | Architecture contract (source scan) | `tests/unit/architecture-contract.test.ts` | local | PASS |
| TC-ARCH-NEG-03 | client code never imports server modules | Architecture contract (source scan) | `tests/unit/architecture-contract.test.ts` | local | PASS |
| TC-BOOK-HP-01 | accepts a Philippine mobile in common formats | Unit | `tests/unit/contact-and-legal.test.ts` | local | PASS |
| TC-BOOK-HP-02 | accepts and lower-cases an email | Unit | `tests/unit/contact-and-legal.test.ts` | local | PASS |
| TC-BOOK-NEG-02 | rejects empty, malformed and non-mobile values | Unit | `tests/unit/contact-and-legal.test.ts` | local | PASS |
| TC-LEGAL-NF-02 | security: escapes markup other than <b> | Unit | `tests/unit/contact-and-legal.test.ts` | local | PASS |
| TC-LEGAL-HP-01 | today's legal copy renders unchanged | Unit | `tests/unit/contact-and-legal.test.ts` | local | PASS |
| TC-ENV-HP-01 | DEV uses barbersdb-dev and PROD uses barbersdb, exactly as configured | Unit | `tests/unit/database-config.test.ts` | local | PASS |
| TC-ENV-NEG-01 | no database set fails clearly instead of defaulting to PROD | Unit | `tests/unit/database-config.test.ts` | local | PASS |
| TC-ENV-NEG-02 | an unknown database id is refused | Unit | `tests/unit/database-config.test.ts` | local | PASS |
| TC-ENV-NEG-03 | DEV pointed at the PROD database (or the reverse) is refused | Unit | `tests/unit/database-config.test.ts` | local | PASS |
| TC-ENV-ODD-01 | local runs without BARBERS_ENV may use either database, but must name one | Unit | `tests/unit/database-config.test.ts` | local | PASS |
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
| TC-LINK-HP-01 | the next review is 6 months after confirming | Unit | `tests/unit/link-review.test.ts` | local | PASS |
| TC-LINK-ODD-01 | due only once the review date has passed | Unit | `tests/unit/link-review.test.ts` | local | PASS |
| TC-LINK-NEG-02 | no prompt for a deactivated barber or a chair with no link yet | Unit | `tests/unit/link-review.test.ts` | local | PASS |
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
| TC-BARBER-HP-06 | menu total from the visit's services, plus a home fee; paid online keeps its amount | Unit | `tests/unit/tips-and-amount.test.ts` | local | PASS |
| TC-TIP-ODD-01 | tip text becomes whole pesos (≥0) | Unit | `tests/unit/tips-and-amount.test.ts` | local | PASS |
| TC-TIP-HP-02 | a tip counts under its payment's method; unpaid tips don't count yet | Unit | `tests/unit/tips-and-amount.test.ts` | local | PASS |
| TC-TIP-HP-03 | barber ranking: sales and remit are service amounts; tips shown apart | Unit | `tests/unit/tips-and-amount.test.ts` | local | PASS |
| TC-TIP-HP-04 | Sales Overview: Collected includes tips (incl. line), Sales doesn't | Unit | `tests/unit/tips-and-amount.test.ts` | local | PASS |
| TC-HOME-HP-01 | Given a guest, when they open /, then Home renders with a sign-in entry and no errors | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-SEO-NF-03 | Given the app shell, then it is not indexable | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-HOME-HP-01 | Given a guest, when they open /, then Home renders with a sign-in entry and no errors | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
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
| TC-BARBER-NF-03 | Given an invalid barber link, then the barber sees that the link was replaced or turned off | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-BOOK-NF-03 | Given an unknown shop code, when a customer opens /book, then they see Shop not found | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-BARBER-NF-03 | Given an invalid barber link, then the barber sees that the link was replaced or turned off | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/guest-and-public.spec.ts` | DEV | PASS (320 + 1280) |
| TC-SEC-HP-01 | Every page response carries the security headers | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | PASS (320 + 1280) |
| TC-AUTH-NEG-03 | Owner API without a token is 401 with a machine-readable code | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | PASS (320 + 1280) |
| TC-BOOK-NEG-03 | An unknown public booking is 404 with code not_found | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | PASS (320 + 1280) |
| TC-SEO-HP-02 | robots.txt on DEV blocks all crawling | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | PASS (320 + 1280) |
| TC-SEC-HP-01 | Every page response carries the security headers | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | PASS (320 + 1280) |
| TC-AUTH-NEG-03 | Owner API without a token is 401 with a machine-readable code | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | PASS (320 + 1280) |
| TC-BOOK-NEG-03 | An unknown public booking is 404 with code not_found | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | PASS (320 + 1280) |
| TC-SEO-HP-02 | robots.txt on DEV blocks all crawling | E2E (Playwright, Chrome, 320px + 1280px) | `tests/e2e/platform.spec.ts` | DEV | PASS (320 + 1280) |
| TC-PAY-HP-03 | Sales Overview Collected card shows Cash ₱X / GCash ₱Y lines; Collection tab shows the split in totals and per barber; History rows show "Paid · Cash/GCash/Other" | Manual (visual) | This doc, section "Manual checks" | DEV | BLOCKED — needs a signed-in owner session on DEV (Jimboy's account or a DEV test phone); the agent has no owner sign-in. Logic covered by automated cases TC-PAY-HP-01/02/04, TC-TIP-HP-02/04 |
| TC-QUEUE-HP-04 | Queue on Oct 19 shows only today's finished visits under "Done today"; picking Oct 17 in the date chip shows "Done · Oct 17" and that day's visits | Manual (visual) | This doc, section "Manual checks" | DEV | BLOCKED — needs a signed-in owner session on DEV (Jimboy's account or a DEV test phone); the agent has no owner sign-in. Logic covered by automated cases TC-QUEUE-HP-01/02/03 |
| TC-BILL-HP-02 | PayMongo checkout opens, pays in test mode, and the webhook upgrades the plan | Manual | This doc, section "Manual checks" | DEV | BLOCKED — PayMongo test keys aren't in the committed DEV config (owner: Jimboy) |
| TC-AUTH-HP-02 | Sign in with Google and with a Firebase test phone number on DEV | Manual | This doc, section "Manual checks" | DEV | BLOCKED — needs Jimboy (Google account / test phone); sign-in itself unchanged in this pass |

| TC-LINK-HP-03 | Barber detail and Manage Shop show "Keep {name}'s link active?" when due; Settings shows "Barber links to review · N"; Confirm clears it; Reset link issues a new link | Manual (visual) | This doc, section "Manual checks" | DEV | BLOCKED — needs a signed-in owner session on DEV (Jimboy's account or a DEV test phone); the agent has no owner sign-in. Logic covered by automated cases TC-LINK-HP-01/02, ODD-01, NEG-01/02 |
| TC-BARBER-HP-07 | On a barber link: only that barber's visits (plus Waiting) show; Amount is read-only "Menu price" in Edit order and Complete; "+ Add tip" works; "Update information" sits under "Confirm & complete" as text | Manual (visual) | This doc, section "Manual checks" | DEV | BLOCKED — needs a real DEV barber link (tokens live in the owner's data; the agent can't read barbersdb-dev: gcloud login expired). Server rules covered by TC-BARBER-HP-02..06, NEG-03..05, TC-TIP-* |
| TC-SALES-HP-02 | Same shop, location and day: owner Sales Overview, Collection ranking, Performance and the barber link's My sales show the same totals | Manual (data cross-check) | This doc, section "Manual checks" | DEV | BLOCKED — raw visits in barbersdb-dev can't be read (gcloud login expired; CLI tokens not reused). Code-level cross-check and regression: TC-SALES-HP-01, NEG-01/02/03, ODD-01 |

Open FAIL: **none**. Skipped automated tests: `TC-SEO-HP-02` skips itself on non-DEV hosts (`test.skip` with reason "DEV-only expectation"); on DEV it runs.

## Manual checks (after the DEV deploy)

1. **Pay split** — sign in as a test owner with paid visits: Sales → Overview, the Collected card shows `Cash ₱…` and `GCash ₱…` lines (Online / Other only when there are any). Sales → Collection: Collected card with the split, each barber row shows the split. History: each paid row shows `Paid · Cash`, `Paid · GCash` or `Paid · Other`.
2. **Done today** — Queue: the "Done today" header lists only visits finished since midnight Manila. Tap the calendar chip, pick an earlier day: label becomes `Done · <date>`, list shows that day. Today chip returns to the default. Check at 320 px that the chips wrap under the label.
3. **Sign-in** — Google popup (desktop) and redirect (mobile), and a Firebase test phone number with `bp.authTest=1`.
4. **Checkout** — only when PayMongo test keys are configured on DEV.
5. **Link review** — set a chair's review date in the past (or wait 6 months): barber detail shows "Keep {name}'s link active?", Settings shows "Barber links to review · 1". Confirm: both go away; the link keeps working either way. Reset link: the old link shows "This link was replaced or turned off."
6. **Barber link** — open Keith's link: only Keith's visits and the shared Waiting list. Complete a cut: amount = menu price, "+ Add tip" ₱50, "Update information" under the button. Owner History shows "Tip ₱50"; Sales Collected shows "incl. ₱50 tips"; Sales total doesn't include it.
7. **Sales cross-check** — for one location and day, compare Sales Overview, Collection, Performance and the barber's My sales; they must agree (a barber with chairs in two branches sees each branch on its own link).

Record date, env and result here when run.
