# 00 Core — summary report

| Field | Value |
| :--- | :--- |
| Feature / task | River AI Rules 1.0.1 compliance pass + Collected pay split + Done-today filter |
| Date | 2026-10-19 (PHT) |
| Author | agent (Grok Bot) for Jimboy Regalado |
| Status | PASS (2 items need Jimboy: C22 dev branch, C24 shared Brevo secret) |

## Architecture shape
- Shape: **A**, single-app variant
- Paths: FE `src/app/(shop)`, `src/app/b`, `src/app/book`, `src/features`, `src/components` · BE `src/app/api`, `src/lib/server`
- Justification: one product with its own UI and API; no reuse across apps yet (docs/architecture-overview.md)

## Core laws acknowledged
- [x] FE/BE contract (no FE business writes; dual GET): TC-ARCH-*, api-reference
- [x] Docs-first: docs/README.md index and all required docs
- [x] Tenant / authz wall: TC-TENANT-NEG-01
- [ ] Environments (`dev` / `main`): no `dev` branch; DEV and PROD share BREVO_API_KEY (open items)
- [x] Hybrid read policy: API GET + polling only
- [x] Audit & safe logging
- [x] Reuse before invent
- [x] Quality / security / perf / SEO / privacy bars

## Risks to core laws
- DEV can send real SMS/email (shared Brevo key).
- No DEV→PROD branch flow, so a CLI deploy from the wrong tree could reach PROD. Mitigated by the runbook: PROD only with Jimboy's OK.

## Gate
- Core readiness: PASS (with 2 open items)
- Notes: details in [../river-ai-rules-1.0.1.md](../river-ai-rules-1.0.1.md#00-core)
