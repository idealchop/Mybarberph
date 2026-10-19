# River AI Rules 1.0.1 — Barbers.ph compliance report

| Field | Value |
| :--- | :--- |
| App | Barbers.ph (`idealchop/Mybarberph`, branch `main`) |
| Rulebook | `idealchop/river-ai-rules` **v1.0.1** |
| Date | 2026-10-19 (Asia/Manila, PHT) |
| Author | agent (Grok Bot) for Jimboy Regalado |
| Change size | **L** |
| Shape | **A**, single-app variant (one Next.js app = UI + API route handlers) |
| Overall | **BLOCKED**: code, docs and tests pass. DEV deploy and the DEV smoke are blocked by an expired Firebase/gcloud login. 4 checklist items stay FAIL until Jimboy decides (dev branch, shared Brevo key, Web Storage, rate limit / App Check). 24 open items listed at the end. |

## Scorecard (items per stage)

| Stage | Items | Before: PASS / FAIL / N/A | After: PASS / FAIL / BLOCKED / N/A | Phase report |
| :--- | :--- | :--- | :--- | :--- |
| 00-core | 32 | 14 / 16 / 2 | 28 / 2 / 0 / 2 | [reports/00-core-summary-report.md](./reports/00-core-summary-report.md) |
| 01-plan | 9 | 1 / 8 / 0 | 9 / 0 / 0 / 0 | [reports/01-plan-summary-report.md](./reports/01-plan-summary-report.md) |
| 02-design | 10 | 1 / 8 / 1 | 8 / 1 / 0 / 1 | [reports/02-design-summary-report.md](./reports/02-design-summary-report.md) |
| 03-build | 22 | 10 / 11 / 1 | 20 / 1 / 0 / 1 | [reports/03-build-summary-report.md](./reports/03-build-summary-report.md) |
| 04-test | 13 | 0 / 12 / 1 | 11 / 0 / 2 / 0 | [reports/04-test-summary-report.md](./reports/04-test-summary-report.md) |
| 05-release | 9 | 4 / 5 / 0 | 7 / 0 / 2 / 0 | [reports/05-release-summary-report.md](./reports/05-release-summary-report.md) |
| 06-operate | 7 | 0 / 5 / 2 | 5 / 0 / 0 / 2 | [reports/06-operate-summary-report.md](./reports/06-operate-summary-report.md) |
| **Total** | **102** | **30 / 65 / 7** | **88 / 4 / 4 / 6** | [rollup](./reports/sdlc-rollup-summary-report.md) |

The checklist is every *Automatic PASS requirement* and *Automatic FAIL* row in each stage gate, plus the hard rules in `00-core.md`. **FAIL after** = needs Jimboy's decision or access (see open items). **BLOCKED** = done, but can't be verified until the DEV deploy.

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
| C21 | Tenant from verified auth; every read and write scoped | 00-core §7 | PASS | **PASS** | getCaller uid / chairLinks token; TC-TENANT-NEG-01, TC-BARBER-HP-01. |
| C22 | `dev` branch → DEV, `main` → PROD | 00-core §8 | FAIL | **FAIL** | No `dev` branch; both backends deploy from local CLI. Needs Jimboy (open item). |
| C23 | Every env var documented | 00-core §8 | FAIL | **PASS** | docs/environments.md, env.example. |
| C24 | Never mix PROD secrets into DEV | 00-core §8 | FAIL | **FAIL** | apphosting.dev.yaml and apphosting.prod.yaml both use the same `BREVO_API_KEY` secret, so DEV sends real SMS/email on the PROD account. Needs a DEV key (open item). |
| C25 | Firestore listeners only where hybrid-read-model documents them | 00-core §9 | PASS | **PASS** | No listeners at all; polling documented in docs/hybrid-read-model.md. |
| C26 | Every mutation audited | 00-core §10 | FAIL | **PASS** | Community and photo writes had no audit; now `auditLog` (0a50c19). Others write shops/{id}/activity. |
| C27 | Errors structured and secret-free | 00-core §10 | FAIL | **PASS** | `{error, code}` on every route; checkout no longer sends PayMongo's message to the client (c1e65ab, 0a50c19). |
| C28 | Reuse before invent | 00-core §11 | PASS | **PASS** | One `api()` client, UI kit components, existing RangeChips reused for the Done filter. |
| C29 | Privacy: minimal PII, none in public responses or logs | 00-core §12 | PASS | **PASS** | publicBooking has no customer name or phone; audit lines have no message bodies. Retention and export are not offered (open item). |
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
| B03 | Security: secrets, webhook signatures, upload limits, XSS sinks, rel=noopener | security-and-vulnerabilities | PASS | **PASS** | HMAC webhook; 5 MB image-only uploads; legal HTML escaped (TC-LEGAL-NF-02); all target=_blank have noopener. |
| B04 | Security: outbound URLs allowlisted (SSRF) | security-and-vulnerabilities | FAIL | **PASS** | Logo proxy followed redirects off the allowlist; fixed in e35e686 (TC-SEC-NEG-01/02). |
| B05 | Security: no leaks in errors; constant-time secret checks | security-and-vulnerabilities 10 | FAIL | **PASS** | Checkout error leak fixed (0a50c19); cron secret uses timingSafeEqual (a992239). |
| B06 | Security headers | security-and-vulnerabilities | FAIL | **PASS** | nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy, HSTS, Permissions-Policy (c1e65ab). CSP not added (open item). |
| B07 | Auth, App Check, rate limits and validation on mutation paths | api-gateway 3 | FAIL | **FAIL** | Public booking/feedback POSTs and geocode have validation but no rate limit or App Check. Needs a policy decision (shop Wi-Fi shares one IP) and console setup (open item). |
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
| T01 | HP/NEG/ODD/NF case matrix created | test-case-creation | FAIL | **PASS** | docs/testing/test-plan.md: 34 HP, 28 NEG, 14 ODD, 10 NF automated + 4 manual. |
| T02 | Every case has 'Applied as' | test-gate | FAIL | **PASS** | Each row names its file or manual section. |
| T03 | Execution log with a Result on every case | test-gate | FAIL | **PASS** | Same doc; BLOCKED rows name the owner and follow-up. |
| T04 | No open FAIL | test-gate | FAIL | **PASS** | 62/62 local PASS; DEV failures are BLOCKED on deploy, not product bugs. |
| T05 | No skipped tests without reason | test-gate | N/A | **PASS** | Only TC-SEO-HP-02 self-skips off DEV, with a reason. |
| T06 | Unit tests green | unit-testing | FAIL | **PASS** | `npm test`. |
| T07 | API contract tests green for core AC | bdd-and-api-contracts | FAIL | **PASS** | tests/api/*. |
| T08 | Architecture contract checks | architecture-contract-testing | FAIL | **PASS** | tests/unit/architecture-contract.test.ts. |
| T09 | Mutation verified through its GET | test-gate | FAIL | **PASS** | TC-STATE-HP-02. |
| T10 | Non-functional cases executed on a deployed env | non-functional-testing | FAIL | **BLOCKED** | Headers/robots/h1 e2e cases need the DEV deploy (expired login). |
| T11 | Manual cases executed | manual-qa | FAIL | **BLOCKED** | Pay split, Done today, sign-in, checkout visual checks need the DEV deploy; checkout also needs PayMongo test keys. |
| T12 | Evidence retained | test-gate 9 | FAIL | **PASS** | Execution log with commands, env and times. |
| T13 | 04 summary report filled | test-gate 10 | FAIL | **PASS** | reports/04-test-summary-report.md (Status BLOCKED). |

## 05-release

| ID | Requirement | Source | Before | After | Evidence / reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| R01 | Lint / tsc / build green | lint-and-health | FAIL | **PASS** | `npm run verify` exit 0 (lint, typecheck, 62 tests, next build). |
| R02 | Release notes / docs in the ship | release-docs-and-notes | FAIL | **PASS** | CHANGELOG.md, docs set. |
| R03 | Commit and push clean, no secrets | commit-and-push | PASS | **PASS** | Pushed to main; no .secret*/.env*/vendor submodule staged. |
| R04 | DEV deployed | ship-and-deploy | PASS | **BLOCKED** | `firebase deploy --only apphosting:barbers-ph-dev` fails: Firebase/gcloud login expired. Needs Jimboy to log in again. |
| R05 | DEV smoke PASS | smoke-and-rollback | FAIL | **BLOCKED** | Smoke runbook written; e2e on the old DEV build: 14 PASS, 10 BLOCKED. |
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

## Feature requests from Jimboy (in this pass)

### Collected split by payment method (`718993d`)

- **Sales → Overview**: the Collected card shows `Cash ₱X` and `GCash ₱Y` lines instead of the plain "Paid" text. `Online` and `Other` lines appear only when there are such visits.
- **Sales → Collection**: a new Collected card with the same split above "Cash to claim", and every barber row shows its own split.
- **Sales detail, Performance**: Online and Other appear when present; the payment filter and split bar include "Other".
- **Each paid visit**: History, the visit sheet and the completion toast say `Paid · Cash`, `Paid · GCash`, `Paid · Online` or `Paid · Other`.
- Uses the stored `payMethod`. A paid visit with no method shows as **Other**. Nothing is guessed. Totals are unchanged.
- Logic in `src/lib/pay-split.ts`; tests TC-PAY-HP-01/02, TC-PAY-ODD-01/02, TC-PAY-NEG-01.

### "Done today" shows today only (`4731e9f`)

- **Queue**: by default the list shows only visits finished since midnight Asia/Manila. Before, it showed every finished visit the queue had loaded (e.g. Oct 16–17 on Oct 19).
- A compact date chip row (the existing Sales `RangeChips`: Today · 7d · All time · calendar) sits beside the section label. Picking a date or range loads those days, and the label follows: `Done today`, `Done · Oct 17`, `Done · Oct 16 – Oct 17`, `Done · last 7 days`, `Done · all time`.
- The "Done" stat under Today now counts today's cuts only.
- **Barber link**: there is no "done today" list there. Done visits are on its History page, which already has its own filters and date input, so it is unchanged.
- Logic in `src/lib/done-range.ts`; tests TC-QUEUE-HP-01/02/03, TC-QUEUE-ODD-01 (midnight boundary), TC-QUEUE-NEG-01.

## Verification

- `npm run verify` (lint, `tsc --noEmit`, Vitest, `next build`) on Node 22: **exit 0**, 62/62 tests.
- E2E (read-only) on DEV: 14 PASS, 10 BLOCKED (cases for changes not yet deployed). Log: [../testing/test-plan.md](../testing/test-plan.md).
- DEV deploy: **BLOCKED** (expired Firebase/gcloud login; not worked around).

## Open items for Jimboy

1. **Deploy:** The Firebase and gcloud logins on the box have expired, so the DEV deploy can't run. Please log in again (`firebase login --reauth`, `gcloud auth login`), then I'll deploy DEV and run the smoke checks.
2. **Deploy:** PROD is not deployed. It needs your OK after DEV smoke passes.
3. **Security:** The hardened `firestore.rules` and `storage.rules` are committed but not deployed, because one deploy updates both the DEV and PROD databases. They need your OK.
4. **Environments:** There is no `dev` branch. Do you want `dev` → DEV and `main` → PROD, with App Hosting rollouts connected to them?
5. **Environments:** DEV and PROD use the same `BREVO_API_KEY` secret, so DEV sends real SMS and email on the production Brevo account. A separate DEV key (or no Brevo on DEV) is needed.
6. **Environments:** `NEXT_PUBLIC_AUTH_TEST_MODE=1` is on for hosted DEV (test phone numbers can skip reCAPTCHA in an opted-in browser). Keep it on, or turn it off?
7. **Environments:** `RIVER_MOBILE_API_KEY`, `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` are commented out in `apphosting.yaml`. If they aren't set in the console, the partner API and checkout don't work on that backend. Please confirm.
8. **Environments:** With no database env var set, the server falls back to the PROD database `barbersdb` (src/lib/firebase/admin.ts). I left this unchanged because I couldn't confirm PROD's App Hosting environment name. Can I switch the default to `barbersdb-dev`?
9. **Security:** Public booking, feedback and geocode routes have no rate limit or App Check (the rulebook requires both on mutation paths). A per-IP limit could block busy shops where customers share the shop Wi-Fi, so this needs your decision, plus App Check setup in the Firebase console.
10. **Security:** No Content-Security-Policy header yet. Adding one needs testing against Firebase Auth, the map, PayMongo and image hosts. Do you want it?
11. **Security:** A barber link can update any booking in its shop, not only its own (the server stamps the barber and location). Should it be limited to the barber's own and unassigned visits?
12. **Product:** Three small browser-storage items remain: the customer's ticket id, the Google sign-in return path and the DEV test-phone switch. The rulebook bans Web Storage for app state, but these are approved UX, so I flagged them instead of changing them. Keep them as exceptions?
13. **Product:** Paid visits with no stored payment method now show as 'Other'. The server still counts them in 'cash to claim' (remit), as before. Confirm that's what you want.
14. **Product:** The barber's own 'My sales' page on the barber link still shows the server totals with no Cash/GCash split. Do you want the split there too?
15. **Product:** The barber link has no 'Done today' list. Its done visits are on the History page, which already has its own filters and date picker, so I didn't change it.
16. **Product:** The privacy and terms pages stay noindex while their text is a draft. Tell me when the text is final and I'll make them indexable.
17. **Cost:** Sales and 'cash to claim' re-read up to 5,000–20,000 and 8,000 visits every 30 seconds while the screen is open. That's fine today but costly for busy shops. Do you want pre-computed daily totals or a longer interval?
18. **Privacy:** There's no retention or export/delete process for customer names and phone numbers in bookings. Please decide a retention period and whether customers can ask for deletion.
19. **Operate:** No monitoring alerts are confirmed. Please create the three in docs/slos-and-alerting.md (5xx rate, denied audit actions, billing budget), or give me project access to do it.
20. **Test:** Visual checks of the Cash/GCash split and the 'Done today' filter, the sign-in check and the PayMongo checkout QA all wait for the DEV deploy. Checkout also needs PayMongo test keys on DEV.
21. **Engineering:** I didn't add a GitHub Actions CI workflow. It needs a `SUBMODULES_TOKEN` repo secret for the private UI kit. Do you want CI? `npm run verify` is the local gate for now.
22. **Engineering:** Optional: move input validation to Zod, and split the app into `apps/web` + `packages/*` (shape A). Both are large refactors and only worth doing if you want them.
23. **Engineering:** `SESSION_COOKIE_NAME` is set in apphosting.yaml but the app never reads it. Remove it, or keep it for later?
24. **Engineering:** The env template is named `env.example`, not `.env.example`, because this repo never commits `.env*` files. Is that name OK?
