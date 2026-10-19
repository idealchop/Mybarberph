# 02 Design — summary report

| Field | Value |
| :--- | :--- |
| Feature / task | River AI Rules 1.0.1 compliance pass + Collected pay split + Done-today filter |
| Date | 2026-10-19 (PHT) |
| Author | agent (Grok Bot) for Jimboy Regalado |
| Status | PASS (D09 Web Storage flagged for Jimboy) |
| Plan gate | PASS |

## Ownership (FE / BE)
| Concern | Owner |
| :--- | :--- |
| Pay split and Done-today maths (pure functions on visit rows) | FE (`src/lib/pay-split.ts`, `src/lib/done-range.ts`) |
| Visit data, remit rule, sales rows | BE (`/api/shop`, `/api/shop/sales-rows`, `/api/shop/remit-claims`) |
| Audit, error codes, outbound fetch guards | BE |

## Modules / files (kebab-case)
- FE: `src/features/sales/*`, `src/features/queue/queue-board.tsx`, `src/features/history/history-screen.tsx`
- BE: `src/lib/server/audit.ts`, route handlers under `src/app/api`

## API contract
| Method | Path | Authz |
| :--- | :--- | :--- |
| GET | /api/shop/sales-rows?days=&full=1 (used by the Done filter for past days) | owner ID token |
| (no new mutations) | — | — |
- Dual GET for mutations: Y (no new ones; existing pairs in api-reference)
- Error codes designed: Y (`ErrorCode` union)

## Schema / tenancy
- Collections/fields: none new
- Tenant resolution: uid from ID token
- Role matrix: [workspace-roles-and-permissions.md](../../workspace-roles-and-permissions.md)

## Read model & live sync
- API GET + visibility-gated polling ([hybrid-read-model.md](../../hybrid-read-model.md))
- Post-mutation refresh: server response / next poll

## Design gate
- [x] PASS
- Failures: D09 browser storage (3 keys) kept as approved UX; flagged

## Gate
- Design phase: PASS
- Ready for Build: Y
