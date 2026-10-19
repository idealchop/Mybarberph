# Barbers.ph docs (index)

Source of truth for how Barbers.ph works. Read this index first (River AI Rules 00-core §2). If a doc and the code disagree, fix one of them in the same change.

| Doc | What it covers |
| :--- | :--- |
| [architecture-overview.md](./architecture-overview.md) | Shape A single Next.js app, FE/BE split, data flow, stack |
| [firestore_schema.md](./firestore_schema.md) | Collections, fields, tenant paths, indexes, audit, PII |
| [auth-flow.md](./auth-flow.md) | Owner sign-in (Google / phone), ID tokens, barber links, partner keys, webhooks |
| [workspace-roles-and-permissions.md](./workspace-roles-and-permissions.md) | Role matrix (owner, barber link, customer, River partner, system) |
| [api-reference.md](./api-reference.md) | Every route, its auth, paired GETs, error codes |
| [backend-documentation.md](./backend-documentation.md) | `src/lib/server/*` services, audit, logging, cost limits |
| [frontend-documentation.md](./frontend-documentation.md) | Routes, feature modules, data hooks, UX states |
| [hybrid-read-model.md](./hybrid-read-model.md) | Read model (API GET + polling; no Firestore listeners) |
| [environments.md](./environments.md) | DEV / PROD targets, env vars, flags, deploy commands |
| [slos-and-alerting.md](./slos-and-alerting.md) | SLO intents, signals, alert gaps |
| [runbooks/release-smoke-rollback.md](./runbooks/release-smoke-rollback.md) | Ship, smoke, rollback |
| [runbooks/incident-and-hotfix.md](./runbooks/incident-and-hotfix.md) | Incident response |
| [testing/test-plan.md](./testing/test-plan.md) | Test matrix (HP/NEG/ODD/NF) + execution log |
| [plans/2026-10-19-river-ai-rules-compliance.md](./plans/2026-10-19-river-ai-rules-compliance.md) | Implementation plan for the compliance pass |
| [compliance/river-ai-rules-1.0.1.md](./compliance/river-ai-rules-1.0.1.md) | River AI Rules 1.0.1 compliance report + phase reports |
| [river-mobile-api.md](./river-mobile-api.md) | River Mobile partner API (`/api/river/v1`) |
| [river-mobile-home-service.md](./river-mobile-home-service.md) | Home-service bookings for River Mobile |

Rulebook: River AI Rules **1.0.1** — <https://github.com/idealchop/river-ai-rules>. Agent instructions: [../AGENTS.md](../AGENTS.md). Release notes: [../CHANGELOG.md](../CHANGELOG.md).
