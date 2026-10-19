# Incident and hotfix

| Level | Meaning | Response |
| :--- | :--- | :--- |
| Critical | PROD down, data risk, auth broken, one shop seeing another's data | Stabilize now: roll back (see [release-smoke-rollback](./release-smoke-rollback.md)) or turn the feature flag off |
| Major | Core flow degraded (booking, queue, sales totals wrong) | Hotfix on DEV first, then PROD with OK |
| Minor | Cosmetic, few users | Normal flow |

## Steps

1. **Confirm**: which env, since when, which shops. Check Cloud Run logs for `barbers-ph` and Error Reporting. Filter `jsonPayload.kind="audit"` for community/photo actions.
2. **Stabilize**: rollback or kill switch before any big fix.
3. **Fix**: reproduce on DEV → fix → add at least an HP + NEG test for the defect → DEV deploy → smoke → ask Jimboy for PROD.
4. Hotfixes still follow the core rules: no browser writes to Firestore, tenant from the token, no secrets in code or logs, no force-push.
5. **Record** in `docs/compliance/reports/` (06-operate report): impact, cause, fix/rollback, follow-ups (tests, docs, alert gap).
6. After Critical/Major: post-release review, and confirm an alert would catch it next time (see [slos-and-alerting](../slos-and-alerting.md)) or open an item.

## Useful queries

- Errors: Cloud Logging, resource `cloud_run_revision`, service `barbers-ph`, `severity>=ERROR`.
- Denied community deletes: `jsonPayload.kind="audit" AND jsonPayload.outcome="denied"`.
- Booking timeline for one shop: Settings → Activity in the app (owner), or `shops/{shopId}/activity` in the Firestore console (read only).
