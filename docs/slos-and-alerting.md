# SLOs and alerting

Informal SLO intents for the critical paths (River AI Rules 06-operate). Signals come from what already exists: Cloud Run / App Hosting request logs and metrics, Cloud Logging (including the `kind:"audit"` lines) and Error Reporting. No new always-on monitoring polls.

| Path | Signal | SLO intent | Who responds | Runbook |
| :--- | :--- | :--- | :--- | :--- |
| Customer books / joins queue (`POST /api/public/bookings`, `/book`) | 5xx rate on the route | < 1% of requests over 1 h | Jimboy | [incident-and-hotfix](./runbooks/incident-and-hotfix.md) |
| Ticket status poll (`GET /api/public/bookings/:id`) | 5xx rate, p95 latency | < 1% 5xx; p95 < 1 s | Jimboy | same |
| Owner queue + state (`GET /api/shop`, `PUT /api/shop/bookings/:id`) | 5xx rate | < 1% over 1 h | Jimboy | same |
| Sign-in | Firebase Auth errors in the browser (no server signal) | user reports; smoke after each deploy | Jimboy | [release-smoke-rollback](./runbooks/release-smoke-rollback.md) |
| PayMongo webhook (`POST /api/billing/webhook`) | any 4xx/5xx from PayMongo's IPs | 0 failed deliveries (PayMongo retries) | Jimboy | same |
| River partner API (`/api/river/v1/*`) | 5xx rate; 401 spikes (bad key) | < 1% 5xx | Jimboy + River Mobile team | same |
| Firestore + AI cost | Billing budget alert on project `mybarberph` | no unexplained day-over-day jump > 2× | Jimboy | [hybrid-read-model cost note](./hybrid-read-model.md#cost-note) |

## Alerts to create (open item, needs project access)

Nothing in the repo can show whether these exist. Proposed, all actionable and low-noise:

1. **Cloud Monitoring alert**: Cloud Run service `barbers-ph`, 5xx ratio > 2% for 10 min → email Jimboy.
2. **Log-based alert**: `jsonPayload.kind="audit" AND jsonPayload.outcome="denied"` > 20 in 10 min (someone probing other shops' posts).
3. **Budget alert** on the billing account for project `mybarberph` at 50/90/100% of the monthly budget.

DEV gets no paging alerts.
