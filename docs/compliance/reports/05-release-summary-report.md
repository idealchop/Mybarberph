# 05 Release — summary report

| Field | Value |
| :--- | :--- |
| Feature / task | River AI Rules 1.0.1 compliance pass + Collected pay split + Done-today filter |
| Date | 2026-10-19 (PHT) |
| Author | agent (Grok Bot) for Jimboy Regalado |
| Status | DEV deployed; smoke partly BLOCKED (signed-in checks) |
| Test gate | automated PASS; manual BLOCKED (signed-in) |

## Health
- Lint / tsc / build: PASS (`npm run verify`, Node 22)

## Docs in ship
- Updated: full docs set, README, CHANGELOG
- What's New: n/a

## Git
- Repos committed/pushed: `idealchop/Mybarberph` main
- Secrets checked: Y
- Hooks skipped: N

## Deploy
| Env | API | FE | Result |
| :--- | :--- | :--- | :--- |
| Dev | barbers-ph-dev | same app | DEPLOYED 2026-10-19 22:04 PHT, commit 2b7e328 (`dev` = `main`); rules released 22:05 PHT (both databases + Storage, approved) |
| Prod | n/a | n/a | n/a |
- Prod OK received: n/a
- Deploy order API→FE: n/a (one deployable)

## Smoke
| Env | HP smoke | Notes |
| :--- | :--- | :--- |
| Dev | PARTIAL | e2e 24/24 PASS; `/home` 200; link 404 text live; signed-in HP/Mutation smoke needs Jimboy |
| Prod | n/a | |

## Rollback readiness
- Plan: [runbooks/release-smoke-rollback.md](../../runbooks/release-smoke-rollback.md); one commit per slice

## URLs
- Dev: https://barbers-ph-dev--mybarberph.asia-southeast1.hosted.app
- Prod: n/a

## Release gate
- [ ] PASS: DEV deployed and automated smoke PASS; signed-in smoke pending. PROD not deployed
