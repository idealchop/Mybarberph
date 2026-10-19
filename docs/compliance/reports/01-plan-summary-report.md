# 01 Plan — summary report

| Field | Value |
| :--- | :--- |
| Feature / task | River AI Rules 1.0.1 compliance pass + Collected pay split + Done-today filter |
| Date | 2026-10-19 (PHT) |
| Author | agent (Grok Bot) for Jimboy Regalado |
| Status | PASS |
| Plan artifact | [docs/plans/2026-10-19-river-ai-rules-compliance.md](../../plans/2026-10-19-river-ai-rules-compliance.md) |

## Slice
- Primary outcome: the app meets River AI Rules 1.0.1 00–06 where it can without Jimboy's decisions; plus the two requested UI changes.
- Out of scope: PROD deploy, rules deploy, new features.
- Shape: A

## Core AC (count)
- Core AC: 6 (plan "Core AC")
- Suggested enhancements: rate limiting / App Check, CSP, pre-aggregated sales totals

## Layer assignment
| Work item | FE / BE / both |
| :--- | :--- |
| Error codes, audit, SSRF guard, cron compare, geocode cache | BE |
| Polls, h1, SEO, kebab-case | FE |
| Pay split, Done-today filter | FE (reads existing fields) |
| Tests, docs | both |

## Impacts
- Schema: none
- Env: none new (documented existing)
- Hybrid: none
- Shared services: none

## Dependencies & sequence
1. Lint/security base → 2. FE hygiene → 3. tests → 4. features → 5. BE hardening → 6. docs → 7. deploy (blocked)

## Risk & rollback
- Top risks: rules deploy hits PROD (not done); display changes to Sales (totals unchanged)
- Kill switch: none needed (display only); existing COMPANION_ENABLED / PLAN_LIMITS_ENABLED
- Spike: no

## Architecture plan gate
- [x] PASS

## Verification planned
- Unit / API contract / architecture (Vitest), E2E on DEV (Playwright), manual visual checks

## Gate
- Plan phase: PASS
- Ready for Design: Y
