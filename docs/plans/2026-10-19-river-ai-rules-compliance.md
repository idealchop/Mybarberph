# Plan — River AI Rules 1.0.1 compliance pass (2026-10-19)

| Field | Value |
| :--- | :--- |
| Size | **L** (touches API, security, docs, tests across the app; no schema change) |
| Shape | A, single-app variant (Next.js app = FE + API route handlers) |
| Owner | Jimboy Regalado; executed by agent |
| Out of scope | PROD deploy, Firestore/Storage rules deploy, new product features beyond the two Jimboy asked for |

## Slices

| # | Work item | FE / BE | Rule | Commit |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Lint to zero | both | 05-release/lint-and-health | `b95c5c5` |
| 2 | Security headers, error codes, Node 22 engines, rules hardening (files only) | BE | 03-build/security, 00-core §1 §8 | `c1e65ab` |
| 3 | Visibility-gated polls | FE | 03-build/performance | `19292b3` |
| 4 | robots.txt, legal descriptions | FE | 03-build/seo-aeo-geo | `65eb98b` |
| 5 | Kebab-case files, feature barrels | FE | 00-core §4, 02-design/modular-structure | `7a89571` |
| 6 | One h1 per screen | FE | 03-build/accessibility | `c5c45aa` |
| 7 | Test suites: unit, API contract, e2e | both | 04-test | `00637b8`, `9390f35` |
| 8 | **Feature (Jimboy):** Collected split Cash / GCash / Other | FE | 01-plan/acceptance-criteria | `718993d` |
| 9 | Error codes everywhere, audit for community/photos, safe checkout errors, barber poll gating | BE (+FE poll) | 00-core §10, 02-design/api-contract-design | `0a50c19` |
| 10 | Logo proxy SSRF guard | BE | 03-build/security | `e35e686` |
| 11 | **Fix (Jimboy):** Queue "Done today" = today in Manila; date chip | FE | 01-plan/acceptance-criteria | `4731e9f` |
| 12 | Constant-time cron secret; bounded geocode cache | BE | 03-build/security, performance | `a992239`, `98dc715` |
| 13 | Docs set, adoption files, env.example, compliance report | docs | 00-core §2, 06-operate/documentation | see report |
| 14 | CI workflow | infra | 05-release/lint-and-health | see report |

## Core AC

1. No browser Firestore/Storage writes; every mutation has a paired GET (already true; verified).
2. Every API error carries a machine-readable `code`.
3. Every mutation is audited (activity log or structured audit log).
4. Lint, typecheck, unit + contract tests and build green on Node 22.
5. Sales: Collected shows Cash and GCash amounts (Online / Other when present) in Overview, Collection totals and per barber; each paid visit says which; no method → "Other".
6. Queue: "Done today" lists only visits finished since Manila midnight by default; picking a date/range shows those days and the label says which.

## Impacts

- Schema: none (reads existing `payMethod`, `completedAt`).
- Env: none new; `env.example` documents existing names.
- Hybrid: none (polling only, documented in `hybrid-read-model.md`).

## Risk and rollback

- Every slice is a separate commit → `git revert <sha>` per slice.
- Rules hardening is committed but **not deployed** (it would hit both databases).
- Pay split changes display only; totals are unchanged. Remit still counts cash + no-method visits (server rule).

## Verification

Unit + API: `npm test`. E2E on DEV after deploy. Manual visual checks for slices 8 and 11. See [testing/test-plan.md](../testing/test-plan.md).
