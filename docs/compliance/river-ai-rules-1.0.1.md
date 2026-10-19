# River AI Rules 1.0.1 — Barbers.ph compliance report

| Field | Value |
| :--- | :--- |
| App | Barbers.ph (`idealchop/Mybarberph`, branch `main`) |
| Rulebook | `idealchop/river-ai-rules` **v1.0.1** |
| Date | 2026-10-19 (Asia/Manila, PHT) |
| Author | agent (Grok Bot) for Jimboy Regalado |
| Change size | **L** |
| Shape | **A**, single-app variant (one Next.js app = UI + API route handlers) |
| Overall | **DEV deployed, PASS on everything automated**: code, docs and 94 local + 28 DEV e2e tests pass. DEV deployed (46fd4cb, 2026-10-20 00:20 PHT) and the hardened rules released (2026-10-19 22:05 PHT). Still BLOCKED: signed-in manual checks (T11, R05). 1 FAIL (D09 Web Storage, needs a decision). 2 ACCEPTED (C24 Brevo, B07 rate limit). 14 open items at the end. |

## Scorecard (items per stage)

| Stage | Items | Before: PASS / FAIL / N/A | After: PASS / ACCEPTED / FAIL / BLOCKED / N/A | Phase report |
| :--- | :--- | :--- | :--- | :--- |
| 00-core | 32 | 14 / 16 / 2 | 29 / 1 / 0 / 0 / 2 | [reports/00-core-summary-report.md](./reports/00-core-summary-report.md) |
| 01-plan | 9 | 1 / 8 / 0 | 9 / 0 / 0 / 0 / 0 | [reports/01-plan-summary-report.md](./reports/01-plan-summary-report.md) |
| 02-design | 10 | 1 / 8 / 1 | 8 / 0 / 1 / 0 / 1 | [reports/02-design-summary-report.md](./reports/02-design-summary-report.md) |
| 03-build | 22 | 10 / 11 / 1 | 20 / 1 / 0 / 0 / 1 | [reports/03-build-summary-report.md](./reports/03-build-summary-report.md) |
| 04-test | 13 | 0 / 12 / 1 | 12 / 0 / 0 / 1 / 0 | [reports/04-test-summary-report.md](./reports/04-test-summary-report.md) |
| 05-release | 9 | 4 / 5 / 0 | 8 / 0 / 0 / 1 / 0 | [reports/05-release-summary-report.md](./reports/05-release-summary-report.md) |
| 06-operate | 7 | 0 / 5 / 2 | 5 / 0 / 0 / 0 / 2 | [reports/06-operate-summary-report.md](./reports/06-operate-summary-report.md) |
| **Total** | **102** | **30 / 65 / 7** | **91 / 2 / 1 / 2 / 6** | [rollup](./reports/sdlc-rollup-summary-report.md) |

The checklist is every *Automatic PASS requirement* and *Automatic FAIL* row in each stage gate, plus the hard rules in `00-core.md`. **ACCEPTED** = Jimboy's recorded decision or exception. **FAIL after** = needs Jimboy's decision. **BLOCKED** = done, but needs a signed-in session to verify by hand.

## 00-core

| ID | Requirement | Source | Before | After | Evidence / reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| C01 | Architecture shape declared | 00-core §0 | FAIL | **PASS** | Shape A, single-app variant: docs/architecture-overview.md, docs/backend-documentation.md. Before: not written down. |
| C02 | No business Firestore writes from the browser | 00-core §1.1 | PASS | **PASS** | No `firebase/firestore` or `firebase/storage` import in src; TC-ARCH-NEG-01. |
| C03 | No Admin SDK in frontend code | 00-core §1.2 | PASS | **PASS** | Every server module imports `server-only`; TC-ARCH-NEG-02/03, TC-ARCH-HP-01. |
| C04 | Every mutation domain has a matching GET | 00-core §1.3 | PASS | **PASS** | docs/api-reference.md 'Paired read' column; TC-STATE-HP-02. |
| C05 | Auth client SDK used for login/logout only | 00-core §1.4 | PASS | **PASS** | src/lib/session.ts; docs/auth-flow.md. |
| C06 | docs/README.md index and required docs (schema, architecture, auth, roles, environments) | 00-core §2 | FAIL | **PASS** | docs/README.md and the linked docs. Before: none of them existed. |
| C07 | Docs match the code | 00-core §2 | FAIL | **PASS** | README.md said 'no backend, all sample data'; rewritten (35ffeb6). |
| C08 | Kebab-case filenames | 00-core §4 | FAIL | **PASS** | 7a89571. |
| C09 | No new constants/ folders | 00-core §4 | PASS | **PASS** | None in src. |
| C10 | Feature modules under src/features/{domain} | 00-core §4 | PASS | **PASS** | Public `index.ts` per feature added in 7a89571. |
| C11 | Node 22 LTS for tests and deploys | 00-core §4 | FAIL | **PASS** | `engines.node` 22.x (c1e65ab); tests run on Node 22. |
| C12 | Lint clean | 00-core §5.1 | FAIL | **PASS** | b95c5c5; `npm run verify`. |
| C13 | Typecheck clean | 00-core §5.2 | PASS | **PASS** | `tsc --noEmit`. |
| C14 | Unit and/or BDD tests for core flows | 00-core §5.3 | FAIL | **PASS** | 62 Vitest cases (unit, API contract, architecture). Before: no tests. |
| C15 | Docs updated with schema/API/auth/env changes | 00-core §5.4 | FAIL | **PASS** | Doc set in 35ffeb6. |
| C16 | No new Critical/Major tech debt | 00-core §5.5 | PASS | **PASS** | Lint and typecheck at zero; no TODO hacks added. |
| C17 | No always-on polls or unbounded lists | 00-core §5.6 | FAIL | **PASS** | Hidden-tab polling stopped (19292b3, 0a50c19). Large Sales/remit reads are capped and documented (docs/hybrid-read-model.md). Cost is an open item. |
| C18 | Public routes meet SEO/AEO/GEO | 00-core §5.7 | FAIL | **PASS** | robots.ts, legal titles and descriptions, one h1 (65eb98b, c5c45aa). Legal pages stay noindex while drafts (open item). |
| C19 | No secrets, .env or debug dumps committed | 00-core §6 | PASS | **PASS** | Secret scan clean; firebase-debug.log gitignored; App Hosting ignore excludes .secret* and .env*. |
| C20 | No skipped hooks, no force-push | 00-core §6 | PASS | **PASS** | Plain commits and fast-forward push. |
| C21 | Tenant from verified auth; every read and write scoped | 00-core §7 | PASS | **PASS** | getCaller uid / chairLinks token; a barber link reads/writes only its own visits plus open waiting ones at its location (d1b385d); TC-TENANT-NEG-01, TC-BARBER-HP-01/02/03, TC-BARBER-NEG-03/04. |
| C22 | `dev` branch → DEV, `main` → PROD | 00-core §8 | FAIL | **PASS** | `dev` created from `main` 2026-10-19, fast-forwarded to each `main` commit (both at 2b7e328). Documented in docs/environments.md and the release runbook. Neither backend is connected to a repo (no automatic rollouts); no rollout config changed. |
| C23 | Every env var documented | 00-core §8 | FAIL | **PASS** | docs/environments.md, env.example. |
| C24 | Never mix PROD secrets into DEV | 00-core §8 | FAIL | **ACCEPTED** | DEV and PROD share the `BREVO_API_KEY` secret. Jimboy's accepted decision (2026-10-19); recorded in docs/environments.md. Databases are now strictly separate: each overlay sets its DB, and the server fails clearly with none or a mismatch (b246f79, TC-ENV-*). |
| C25 | Firestore listeners only where hybrid-read-model documents them | 00-core §9 | PASS | **PASS** | No listeners at all; polling documented in docs/hybrid-read-model.md. |
| C26 | Every mutation audited | 00-core §10 | FAIL | **PASS** | Community and photo writes had no audit; now `auditLog` (0a50c19). Others write shops/{id}/activity. |
| C27 | Errors structured and secret-free | 00-core §10 | FAIL | **PASS** | `{error, code}` on every route; checkout no longer sends PayMongo's message to the client (c1e65ab, 0a50c19). |
| C28 | Reuse before invent | 00-core §11 | PASS | **PASS** | One `api()` client, UI kit components, existing RangeChips reused for the Done filter. |
| C29 | Privacy: minimal PII, none in public responses or logs | 00-core §12 | PASS | **PASS** | publicBooking has no customer name or phone; audit lines have no message bodies. No retention/deletion job: Jimboy's accepted decision (2026-10-19). |
| C30 | Change size declared; 00 summary report for M/L | reports/README | FAIL | **PASS** | Size L; docs/compliance/reports/00-core-summary-report.md. |
| C31 | White-label (shape C) rules | 00-core §3 | N/A | **N/A** | Not a River Kit fork. |
| C32 | consumers.md for shared services | 00-core §2 | N/A | **N/A** | Not shape B. |

## 01-plan

| ID | Requirement | Source | Before | After | Evidence / reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| P01 | No automatic-FAIL ideas (FE writes, FE AI, client tenant ids…) | architecture-plan-gate | PASS | **PASS** | Nothing planned on the client except display logic. |
| P02 | Every work item tagged FE / BE / both | architecture-plan-gate 1 | FAIL | **PASS** | docs/plans/2026-10-19-river-ai-rules-compliance.md. |
| P03 | Shape declared; shared services named | architecture-plan-gate 2 | FAIL | **PASS** | Same plan. |
| P04 | Schema / env / hybrid impacts listed | architecture-plan-gate 3 | FAIL | **PASS** | Plan 'Impacts': none. |
| P05 | Dual endpoints listed for new mutation domains | architecture-plan-gate 4 | FAIL | **PASS** | No new mutation domains; existing pairs in api-reference. |
| P06 | Verification + docs checklist | architecture-plan-gate 5 | FAIL | **PASS** | Plan 'Verification'. |
| P07 | Core acceptance criteria | acceptance-criteria | FAIL | **PASS** | Plan 'Core AC' 1–6 (incl. pay split and Done today). |
| P08 | Risk and rollback | risk-and-rollback | FAIL | **PASS** | Plan 'Risk and rollback': one commit per slice. |
| P09 | 01 summary report filled | architecture-plan-gate 6 | FAIL | **PASS** | reports/01-plan-summary-report.md. |

## 02-design

| ID | Requirement | Source | Before | After | Evidence / reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D01 | FE/BE ownership table | architecture-split | FAIL | **PASS** | docs/backend-documentation.md 'Layers'; 02 report. |
| D02 | Module placement; no cross-feature deep imports | modular-structure | FAIL | **PASS** | Feature barrels (7a89571); only same-feature imports remain. |
| D03 | Schema + audit designed | data-integrity | FAIL | **PASS** | docs/firestore_schema.md; audit in backend-documentation. |
| D04 | Migration/backfill when data breaks | data-migration | N/A | **N/A** | No schema change. |
| D05 | API contract table with errors | api-contract-design | FAIL | **PASS** | docs/api-reference.md. |
| D06 | Tenant resolution + role matrix | tenancy-and-roles-design | FAIL | **PASS** | docs/workspace-roles-and-permissions.md. |
| D07 | Read model + live-sync refresh designed | hybrid-and-live-sync | FAIL | **PASS** | docs/hybrid-read-model.md. |
| D08 | No second apiClient / auth stack | design-gate | PASS | **PASS** | Single `api()` in src/lib/cloud.ts. |
| D09 | No Web Storage for app state | modular-structure §4 | FAIL | **FAIL** | Three keys remain: customer ticket id (localStorage), Google-redirect return path (sessionStorage), DEV test-phone opt-in (localStorage). All approved UX; flagged for Jimboy rather than changed. |
| D10 | 02 summary report filled | design-gate 8 | FAIL | **PASS** | reports/02-design-summary-report.md. |

## 03-build

| ID | Requirement | Source | Before | After | Evidence / reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| B01 | Files match kebab-case layout | naming-and-clean-code | FAIL | **PASS** | 7a89571. |
| B02 | Tech debt bar | tech-debt-and-code-quality | PASS | **PASS** | Lint/tsc zero. |
| B03 | Security: secrets, webhook signatures, upload limits, XSS sinks, rel=noopener | security-and-vulnerabilities | PASS | **PASS** | HMAC webhook; 5 MB image-only uploads; legal HTML escaped (TC-LEGAL-NF-02); all target=_blank have noopener. Hardened Firestore/Storage rules deployed 2026-10-19 22:05 PHT (approved). Barber links never expire: Jimboy's accepted decision, with a 6-month owner review; turning the barber off stops the link (3b5f67a, d1b385d). |
| B04 | Security: outbound URLs allowlisted (SSRF) | security-and-vulnerabilities | FAIL | **PASS** | Logo proxy followed redirects off the allowlist; fixed in e35e686 (TC-SEC-NEG-01/02). |
| B05 | Security: no leaks in errors; constant-time secret checks | security-and-vulnerabilities 10 | FAIL | **PASS** | Checkout error leak fixed (0a50c19); cron secret uses timingSafeEqual (a992239). |
| B06 | Security headers | security-and-vulnerabilities | FAIL | **PASS** | nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy, HSTS, Permissions-Policy (c1e65ab). CSP not added (open item). |
| B07 | Auth, App Check, rate limits and validation on mutation paths | api-gateway 3 | FAIL | **ACCEPTED** | Validation on every mutation path. No rate limit or App Check: Jimboy's accepted exception (2026-10-19), recorded in docs/backend-documentation.md 'Abuse controls'. |
| B08 | API per contract: error codes, pagination | api-gateway | FAIL | **PASS** | Codes on every route; cursor/limit documented. |
| B09 | Validation at the boundary (Zod or equivalent) | security-and-vulnerabilities 3 | PASS | **PASS** | Hand-written guards (allowlists, clamps, size checks). Zod adoption optional (open item). |
| B10 | FE uses the single apiClient | frontend-implementation | PASS | **PASS** | `api()`. |
| B11 | Authz enforced on every route | authz-implementation | PASS | **PASS** | Route inventory in api-reference; TC-AUTH-NEG-01/02/03, TC-RIVER-NEG-01/02, TC-BILL-NEG-01/02, TC-CRON-NEG-01. |
| B12 | Loading / empty / error states and mutation feedback | ux-states-and-feedback | PASS | **PASS** | New Done list has loading and empty text; toasts show the pay method. |
| B13 | Narrow-phone UI (320 px) | responsive-ui | PASS | **PASS** | E2E at 320 px; Done chips wrap under the label. |
| B14 | Accessibility: one h1, main landmark, labels | accessibility | FAIL | **PASS** | c5c45aa. |
| B15 | SEO/AEO/GEO on public routes | seo-aeo-geo | FAIL | **PASS** | 65eb98b. |
| B16 | Performance budgets | performance | FAIL | **PASS** | Visibility-gated polls; bounded geocode cache (98dc715); Done list fetches history only when a date is picked. |
| B17 | Flags / kill switch for high-risk features | feature-flags | PASS | **PASS** | COMPANION_ENABLED, PLAN_LIMITS_ENABLED. |
| B18 | Mobile/offline (Capacitor) | mobile-and-offline | N/A | **N/A** | No Capacitor app. |
| B19 | AI on the backend with quotas | ai-and-genkit | PASS | **PASS** | Companion server-side with monthly quota. |
| B20 | Integrations on the backend | integrations | PASS | **PASS** | PayMongo, Brevo, geocode, AI all server-side. |
| B21 | Unit tests added for touched services | build-gate 14 | FAIL | **PASS** | tests/unit, tests/api. |
| B22 | 03 summary report filled | build-gate 15 | FAIL | **PASS** | reports/03-build-summary-report.md. |

## 04-test

| ID | Requirement | Source | Before | After | Evidence / reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T01 | HP/NEG/ODD/NF case matrix created | test-case-creation | FAIL | **PASS** | docs/testing/test-plan.md: 122 automated rows (48 HP, 44 NEG, 20 ODD, 10 NF) + 8 manual. |
| T02 | Every case has 'Applied as' | test-gate | FAIL | **PASS** | Each row names its file or manual section. |
| T03 | Execution log with a Result on every case | test-gate | FAIL | **PASS** | Same doc; BLOCKED rows name the owner and follow-up. |
| T04 | No open FAIL | test-gate | FAIL | **PASS** | 94/94 local PASS; 28/28 DEV e2e PASS. |
| T05 | No skipped tests without reason | test-gate | N/A | **PASS** | Only TC-SEO-HP-02 self-skips off DEV, with a reason. |
| T06 | Unit tests green | unit-testing | FAIL | **PASS** | `npm test`. |
| T07 | API contract tests green for core AC | bdd-and-api-contracts | FAIL | **PASS** | tests/api/*. |
| T08 | Architecture contract checks | architecture-contract-testing | FAIL | **PASS** | tests/unit/architecture-contract.test.ts. |
| T09 | Mutation verified through its GET | test-gate | FAIL | **PASS** | TC-STATE-HP-02. |
| T10 | Non-functional cases executed on a deployed env | non-functional-testing | FAIL | **PASS** | Headers, robots, h1, error codes, sign-in sheet: e2e on DEV build 46fd4cb, 28/28 PASS (2026-10-20 00:20 PHT). |
| T11 | Manual cases executed | manual-qa | FAIL | **BLOCKED** | Pay split, Done today, link review, barber link (scope, amount lock), sales cross-check, the auto-opening sign-in sheet and Settings › Account and sign-in need a signed-in owner session or a real DEV barber link; checkout also needs PayMongo test keys. Logic covered by automated cases. |
| T12 | Evidence retained | test-gate 9 | FAIL | **PASS** | Execution log with commands, env and times. |
| T13 | 04 summary report filled | test-gate 10 | FAIL | **PASS** | reports/04-test-summary-report.md (Status BLOCKED). |

## 05-release

| ID | Requirement | Source | Before | After | Evidence / reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| R01 | Lint / tsc / build green | lint-and-health | FAIL | **PASS** | `npm run verify` exit 0 (lint, typecheck, 94 tests, next build). |
| R02 | Release notes / docs in the ship | release-docs-and-notes | FAIL | **PASS** | CHANGELOG.md, docs set. |
| R03 | Commit and push clean, no secrets | commit-and-push | PASS | **PASS** | Pushed to main; no .secret*/.env*/vendor submodule staged. |
| R04 | DEV deployed | ship-and-deploy | PASS | **PASS** | `firebase deploy --only apphosting:barbers-ph-dev`: 2026-10-19 22:04 PHT (2b7e328) and 2026-10-20 00:20 PHT (46fd4cb). Rules released 2026-10-19 22:05 PHT. |
| R05 | DEV smoke PASS | smoke-and-rollback | FAIL | **BLOCKED** | Automated: e2e 28/28 PASS, `/home` and `/settings/account` 200, link 404 text live, DB guard resolves barbersdb-dev. Signed-in HP/Mutation smoke needs Jimboy. |
| R06 | PROD only with the user's OK | release-gate | PASS | **PASS** | PROD not deployed. |
| R07 | Rollback path known | smoke-and-rollback | FAIL | **PASS** | docs/runbooks/release-smoke-rollback.md. |
| R08 | URLs and status reported | release-gate 7 | PASS | **PASS** | This report and the chat summary. |
| R09 | 05 summary report filled | release-gate 8 | FAIL | **PASS** | reports/05-release-summary-report.md (Status BLOCKED). |

## 06-operate

| ID | Requirement | Source | Before | After | Evidence / reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| O01 | Docs status clear; no drift left | documentation | FAIL | **PASS** | Doc set; README drift fixed; firestore_schema plan ids corrected. |
| O02 | Observability / cost actions done or ticketed | observability-and-cost | FAIL | **PASS** | Audit log added; Sales/remit read cost ticketed as an open item. |
| O03 | SLO / alert detectability for critical paths | slos-and-alerting | FAIL | **PASS** | docs/slos-and-alerting.md. Creating the alerts needs project access (open item). |
| O04 | Incident and hotfix process | incident-and-hotfix | FAIL | **PASS** | docs/runbooks/incident-and-hotfix.md. |
| O05 | Post-release review | post-release-review | N/A | **N/A** | No incident in this pass. |
| O06 | Rulebook maintenance | rulebook-maintenance | N/A | **N/A** | No rulebook change. |
| O07 | 06 summary report filled | operate-gate 7 | FAIL | **PASS** | reports/06-operate-summary-report.md. |

## Changes in this pass (commits on `main`)

| Commit | Change |
| :--- | :--- |
| `b95c5c5` | Lint: zero errors and warnings (river-ai-rules R1) |
| `c1e65ab` | Security hardening (river-ai-rules 03-build/security, 00-core §1/§8) |
| `19292b3` | Polling: skip status/notification polls in hidden tabs (river-ai-rules 03-build/performance) |
| `65eb98b` | SEO: robots.txt and legal page descriptions (river-ai-rules 03-build/seo-aeo-geo) |
| `7a89571` | Kebab-case filenames and feature public APIs (river-ai-rules 00-core §4, 02-design/modular-structure) |
| `c5c45aa` | A11y: one h1 per screen (Home sr-only title, Companion and Update shop titles as h1) |
| `00637b8` | Tests: Vitest unit + API contract suites, read-only Playwright e2e |
| `718993d` | Sales: Collected split by payment method (Cash / GCash, Other when no method) |
| `0a50c19` | API: error codes on every route, structured audit for community/photos, safe checkout errors |
| `e35e686` | Logo proxy: SSRF guard on redirects, early size reject, fetch timeout |
| `4731e9f` | Queue: "Done today" shows only today (Manila); date chip for earlier days |
| `a992239` | Companion cron: constant-time secret check |
| `98dc715` | Geocode: cap the in-memory search cache at 500 entries |
| `9390f35` | e2e: TC-BOOK-NEG-03 passes the required ?shop= so it tests the 404, not the 400 |
| `a3e5b41` | Adopt River AI Rules 1.0.1: AGENTS.md, Cursor rules, PR template, env.example |
| `35ffeb6` | Docs: full app doc set per River AI Rules 00-core §2 and 06-operate |
| `fd193f3` | Tests: architecture contract (no client Firestore/Storage SDK, Admin SDK server-only); npm run verify |
| `6353753` | Tests: TC-STATE-HP-02 mutation then paired GET (04-test 'mutation without verified GET') |
| `6a32fd6` | Compliance report: River AI Rules 1.0.1 (102 items, before/after per stage), phase reports 00–06 + rollup |
| `4e9cbae` | Test plan: correct the execution window (19:54–20:05 PHT) |
| `b246f79` | Firestore: no silent fallback to the PROD database |
| `3b5f67a` | Barber links: never expire; owner confirms each link every 6 months (nudge only) |
| `d1b385d` | Barber link: server enforces own bookings only; links resolve without expiry |
| `d0b8fac` | Barber My sales: Collected split (Cash / GCash, Online and Other when present) |
| `93df062` | Barber link: amount locked to the menu price; optional tip; 'Update information' link |
| `8d281a0` | Docs: dev branch (dev -> DEV, main -> PROD), DB guard, accepted decisions, barber link scope/review, amount lock and tip |
| `2b7e328` | Sales: barber link My sales and /sales count only the link's location; ranking never drops sales |
| `3eb45dc` | Compliance report: Jimboy's decisions recorded, DEV deploy + rules released, e2e 24/24 on DEV, sales cross-check |
| `0900b43` | Compliance report: fix open-item count in the summary |
| `45ae0ea` | Remove tips; a paid visit with no method shows and counts as Cash |
| `c42199d` | Settings › Account: sign-in method and Change password |
| `24ed75d` | Sign-in sheet opens by itself once per visit on dashboard pages |
| `4dd58a8` | Docs: auth flow (sign-in sheet once per visit, Settings › Account, no password sign-in) |
| `46fd4cb` | Barber detail: remove the 'Barber link' card and Reset link |
| `a9a2882` | Compliance report + test plan: Jimboy's 2026-10-20 decisions (no tips, no-method = Cash, Waiting kept, Reset link removed), sign-in changes, DEV 46fd4cb e2e 28/28 |

## Feature requests from Jimboy (in this pass)

### Collected split by payment method (`718993d`)

- **Sales → Overview**: the Collected card shows `Cash ₱X` and `GCash ₱Y` lines instead of the plain "Paid" text. `Online` and `Other` lines appear only when there are such visits.
- **Sales → Collection**: a new Collected card with the same split above "Cash to claim", and every barber row shows its own split.
- **Sales detail, Performance**: Online and Other appear when present; the payment filter and split bar include "Other".
- **Each paid visit**: History, the visit sheet and the completion toast say `Paid · Cash`, `Paid · GCash` or `Paid · Online`.
- Uses the stored `payMethod`. A paid visit with no method counts and shows as **Cash**, the same as the server (Jimboy, 2026-10-20; the first version showed it as "Other"). Totals are unchanged.
- Logic in `src/lib/pay-split.ts`; tests TC-PAY-HP-01/02, TC-PAY-ODD-01/02, TC-PAY-NEG-01.

### "Done today" shows today only (`4731e9f`)

- **Queue**: by default the list shows only visits finished since midnight Asia/Manila. Before, it showed every finished visit the queue had loaded (e.g. Oct 16–17 on Oct 19).
- A compact date chip row (the existing Sales `RangeChips`: Today · 7d · All time · calendar) sits beside the section label. Picking a date or range loads those days, and the label follows: `Done today`, `Done · Oct 17`, `Done · Oct 16 – Oct 17`, `Done · last 7 days`, `Done · all time`.
- The "Done" stat under Today now counts today's cuts only.
- **Barber link**: there is no "done today" list there. Done visits are on its History page, which already has its own filters and date input, so it is unchanged.
- Logic in `src/lib/done-range.ts`; tests TC-QUEUE-HP-01/02/03, TC-QUEUE-ODD-01 (midnight boundary), TC-QUEUE-NEG-01.


### Jimboy's decisions on the open items (2026-10-19)

- **Hardened Firestore/Storage rules**: approved and deployed 2026-10-19 22:05 PHT (both databases + Storage).
- **Shared Brevo key (DEV = PROD)**: accepted decision (C24).
- **Separate databases**: DEV `barbersdb-dev`, PROD `barbersdb`; the silent fallback to PROD was removed, and the server fails clearly with no database or a mismatched one (b246f79).
- **No rate limiting / App Check**: accepted exception (B07).
- **A barber link only sees and edits its own bookings**: enforced on the server (d1b385d).
- **No customer data retention/deletion job**: accepted decision.
- **Barber links never expire**: same token; the owner confirms each link every 6 months as a nudge only; turning the barber off still stops the link (3b5f67a, d1b385d).
- **`dev` branch**: `dev` → DEV, `main` → PROD; no auto-deploy config changed.
- **(2026-10-20) Barber links keep seeing unassigned Waiting visits at their location**: kept as built.
- **(2026-10-20) No Reset link button**: the 'Barber link' card (Reset link) on the barber detail page was removed. Turning the barber off still stops the link, and the 6-month review stays.
- **(2026-10-20) No tips**: the optional tip was removed entirely (UI, totals, server, tests, docs; 45ae0ea). Tip fields already in data are ignored. The amount lock and 'Update information' stay.
- **(2026-10-20) No email/password sign-in**: sign-in stays Google and text code only, so there is no Forgot password. Settings › Account shows the sign-in method; its Change password form stays dormant behind the password-provider check.
- **(2026-10-20) A paid visit with no method is Cash**: the client split and labels now say Cash, matching the server's save and remit rule (45ae0ea).

**Correction to the earlier report:** it said the barber's My sales had no Cash/GCash split. In fact it had Cash and GCash tiles, but no Online/Other, and it counted paid visits with no method as cash. It now has one "Collected" card with the same split as the owner's Overview (d0b8fac, TC-PAY-HP-04).

### Barber links: never expire, 6-month review (`3b5f67a`, `d1b385d`)

- The server has no expiry check. The token never rotates on its own. Old `linkExpiresAt` is read as the review date, so no link broke.
- "Keep {name}'s link active?" + Confirm shows on the barber detail page and in Manage Shop › Barbers; "Barber links to review · N" shows in Settings. Confirm sets the next review 6 months out. If the owner never confirms, the link keeps working.
- Turning the barber off stops the link. The Reset link card from the first version was removed (2026-10-20).
- Error text: "This link was replaced or turned off." Tests TC-LINK-HP-01/02, ODD-01, NEG-01/02, TC-BARBER-NF-03.

### Barber link: own bookings only (`d1b385d`)

- `GET /api/barber/:token` returns that barber's visits plus unassigned visits still waiting at their location (so Waiting → Accept works). A `PUT` on another barber's visit answers 404, and the screen says "Another barber already has this customer." Tests TC-BARBER-HP-02/03, NEG-03/04, ODD-01.

### Amount locked, "Update information" (`93df062`, tip removed in `45ae0ea`)

- On a barber link, Amount is a read-only "Menu price" in Edit order and the Complete popup. The server overrides any amount with the menu total (+ home fee; a visit paid online keeps its amount). Owners can still edit amounts.
- Barber Complete popup: "Update information" is a text link under "Confirm & complete".
- The optional tip from the first version was removed on Jimboy's request (2026-10-20). Tests TC-BARBER-NEG-05, HP-04/05/06, ODD-02.

### Sign-in (2026-10-20: `c42199d`, `24ed75d`)

- **Settings › Account** shows how the owner signs in ("You sign in with Google" / "with a text code"). An account with a password gets Change password: re-authenticate with the current password, then `updatePassword`, with clear errors. Tests TC-ACCT-HP-01, NEG-01/02.
- **The sign-in sheet opens by itself once per visit** on shop-app pages for signed-out visitors. It's dismissable, and never opens on booking, ticket, barber link, Moments, privacy, terms, map credits or during "Signing you in…". Tests TC-AUTH-HP-03/04, NEG-04/05, ODD-01.
- **"Forgot password?" was not built:** Jimboy's accepted decision (2026-10-20) is no email/password sign-in, so there's nothing to reset. The Change password form stays dormant behind the password-provider check.

### Sales mismatch between views (`2b7e328`)

Jimboy reported that the two views didn't match. gcloud is logged out, so I couldn't read barbersdb-dev. Instead I checked every view's period, filter and identity rule against a fixture built from his numbers.

| View (same shop, San Antonio, Oct 19) | Expected from raw visits | Shown before the fix | After the fix |
| :--- | :--- | :--- | :--- |
| Owner Sales Overview · Today | ₱800 · 2 cuts | ₱800 · 2 | ₱800 · 2 |
| Owner Collection ranking · Keith | ₱800 (Cash ₱250, GCash ₱550) | ₱800 | ₱800 |
| Barber link My sales · This week (Mon Oct 19 = today) | ₱800 · 2 cuts · Cash ₱250 · GCash ₱550 | **₱2,200 · 5 · Cash ₱1,650 · GCash ₱550** (matches his screenshot) | ₱800 · 2 |
| Barber link My sales · By service | Haircut·Wax 1 ₱550, Haircut 1 ₱250 | Haircut·Wax 2 ₱1,050, Haircut·Wax·Shaving 1 ₱650, Haircut 2 ₱500 | per its location only |
| Barber link `/sales` "mine" | the link's location | the bigger branch | the link's location |
| Owner ranking with a turned-off chair | rows add up to the Sales total | that barber's sales dropped at every location | only an empty row at that location is hidden |

- **Cause 1 (main):** the barber link's My sales/performance matched visits by `barberId` at any location. A barber with chairs in two branches got both branches on one link (here, ₱1,400 of Pacita cash). The link's Queue/History and the owner's per-location Sales count one location. **Fixed:** the link's location only.
- **Cause 2:** `/api/barber/:token/sales` took `barbers[0]` with no location filter. **Fixed.**
- **Cause 3:** the owner ranking hid every row of a barber whose chair was turned off at any location, sales included. **Fixed:** `rankedBarbers`.
- **Cause 4 (minor):** the owner `barberSales` didn't use the chair id for old chair-only visits, unlike the client stats. **Fixed.**
- **Not a bug:** "This week" on the barber link is Monday–Sunday (Manila), while the owner's "7d" is a rolling 7 days. Day boundaries are Manila midnight everywhere. The Haircut·Wax bucket at ₱500 and ₱550 is one service label with two amounts. The ₱550 was probably edited by hand, which the amount lock now prevents (for a real extra, use the tip).
- Regression tests TC-SALES-HP-01, NEG-01/02/03, ODD-01. The fixture gives exactly ₱2,200 / 5 / ₱1,650 on the old code.


## Verification

- `npm run verify` (lint, `tsc --noEmit`, Vitest, `next build`) on Node 22: **exit 0**, 94/94 tests.
- DEV deploy: `firebase deploy --only apphosting:barbers-ph-dev`, done 2026-10-19 22:00 PHT (8d281a0) and 22:04 PHT (2b7e328). `main` = `dev` = 2b7e328. Backends: `barbers-ph-dev` environment `dev`, `barbers-ph` environment `prod` (read-only check), so each picks its overlay and database.
- Rules: `firebase deploy --only firestore:rules,storage`, released 22:05 PHT (approved; both databases + Storage).
- DEV redeployed 2026-10-20 00:20 PHT (46fd4cb: tips removed, no-method = Cash, Settings › Account, sign-in sheet once per visit, Reset link removed).
- E2E (read-only) on DEV build 46fd4cb: **28/28 PASS** (2026-10-20 00:20 PHT). Log: [../testing/test-plan.md](../testing/test-plan.md).
- Manual signed-in checks: BLOCKED (need Jimboy's session / a DEV barber link).

## Open items for Jimboy

1. **Deploy:** PROD is not deployed. It needs your OK after the signed-in DEV checks pass.
2. **Test:** The signed-in manual checks on DEV (pay split, Done today, link review, barber link scope / amount lock / tip, the sales cross-check, sign-in) need your owner session or a DEV test phone, and a real barber link. All their logic is covered by automated tests.
3. **Access:** gcloud is still logged out on the box (`gcloud auth login`). Without it I can't read barbersdb-dev, so the sales cross-check was done in code against a fixture built from your screenshots, not against your live visits.
4. **Environments:** `NEXT_PUBLIC_AUTH_TEST_MODE=1` is on for hosted DEV (test phone numbers can skip reCAPTCHA in an opted-in browser). Keep it on, or turn it off?
5. **Environments:** `RIVER_MOBILE_API_KEY`, `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` are commented out in `apphosting.yaml`. If they aren't set in the console, the partner API and checkout don't work on that backend. Please confirm.
6. **Security:** No Content-Security-Policy header yet. Adding one needs testing against Firebase Auth, the map, PayMongo and image hosts. Do you want it?
7. **Product:** Three small browser-storage items remain: the customer's ticket id, the Google sign-in return path and the DEV test-phone switch. The rulebook bans Web Storage for app state, but these are approved UX. Keep them as exceptions?
8. **Product:** The privacy and terms pages stay noindex while their text is a draft. Tell me when the text is final.
9. **Cost:** Sales and 'cash to claim' re-read up to 5,000–20,000 and 8,000 visits every 30 seconds while the screen is open. Pre-computed daily totals or a longer interval?
10. **Operate:** No monitoring alerts are confirmed. Please create the three in docs/slos-and-alerting.md, or give me project access.
11. **Engineering:** No GitHub Actions CI (needs a `SUBMODULES_TOKEN` secret for the private UI kit). `npm run verify` is the local gate.
12. **Engineering:** Optional: Zod validation and an `apps/web` + `packages/*` split. Both are large refactors.
13. **Engineering:** `SESSION_COOKIE_NAME` is set in apphosting.yaml but never read. Remove it?
14. **Engineering:** The env template is `env.example`, not `.env.example`, because this repo never commits `.env*` files. OK?
