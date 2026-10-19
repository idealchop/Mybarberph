# Backend documentation

## Shape

River AI Rules 01-plan "shape A" in its **single-app** form: one Next.js 16 app is both the web UI and the API. The backend is the route handlers in `src/app/api/**/route.ts` plus server modules in `src/lib/server/*`. Every server module starts with `import "server-only"`, so a client bundle can't import it (build error).

There is no separate `packages/` workspace yet. Splitting into `apps/web` + `packages/api|domain` is an open item (needs Jimboy's go-ahead; it moves every file).

## Layers

| Layer | Where | Rule |
| :--- | :--- | :--- |
| HTTP | `src/app/api/**/route.ts` | Parse + validate input, resolve caller and tenant, call a server module, map to JSON/`apiError` |
| Auth | `src/lib/server/auth.ts` (`getCaller`, `json`, `apiError`, helpers), `river.ts` (`riverAuth`) | Verified identity only. Never trust a shop id from the body |
| Domain + data | `src/lib/server/shops.ts` (state, bookings, chair links), `remit.ts`, `barber-sales.ts`, `home-service.ts`, `companion/*`, `paymongo.ts` | Firestore Admin SDK, always under `shops/{shopId}` |
| Side effects | `activity.ts` (activity + notifications), `audit.ts` (structured audit log), `notify.ts` (Brevo SMS/email) | Fire after the write succeeds |
| Shared pure logic | `src/lib/*.ts` (plans, hours, money, pay split, ticket codes, sales maths) | Used by both server and client; no I/O |

## Tenant wall

- Owner routes: `shopId = (await getCaller(req)).uid`. No route accepts another shop id from an owner.
- Barber routes: `shopId` comes from `chairLinks/{token}` on the server, and a link only reads/writes its own barber's visits plus open ones waiting at its location (`barberAccess`). The amount it saves is always the menu price (`barberPrice`).
- Partner and public routes take `shopId` from the path but read only public fields of `listed` shops (partner) or the public profile (public).
- Firestore and Storage security rules are the boundary for any direct client access: no client writes business data; public read only for listed shops' public fields; owner read of `private/*`. The server's Admin SDK bypasses them. The hardened rules in this repo were **deployed on 2026-10-19 22:05 PHT** with Jimboy's approval (one deploy updates both `barbersdb-dev` and `barbersdb`, and Storage).

## Validation

Hand-written guards at each handler: type checks, string length caps (`slice`), enum allowlists (`STATE_KEYS`, booking statuses, pay methods), number clamps, size/type checks on uploads, regex on tokens. Zod is not a dependency; adopting it is an open item ("Zod or equivalent" — current guards are the equivalent).

## Abuse controls

No per-IP rate limiting and no Firebase App Check. **Accepted exception (Jimboy, 2026-10-19):** not needed at the current scale. What limits abuse today: unguessable ids/tokens as capabilities, server-side validation and size caps, the Partner walk-in limit, Companion quotas, and PayMongo/Brevo provider limits. Revisit if public booking spam or link scraping shows up.

## Errors

`apiError(code, message, status)` → `{ error, code }`. Upstream failures (PayMongo, AI, maps) return a generic message with `upstream_error`; the detail goes to the server log only. See [api-reference.md](./api-reference.md#errors).

## Audit

| What | Where it goes |
| :--- | :--- |
| Shop state diffs, booking lifecycle, remit claims, plan changes | `shops/{id}/activity` (+ `notifications`) via `logActivity` / `bookingActivity` / `stateActivity`. Shown to the owner in Settings → Activity |
| Community posts/likes/reposts/replies/deletes, denied deletes, photo uploads | Cloud Logging, one JSON line `{ kind: "audit", action, shopId, actor, resource, outcome }` via `auditLog` (`src/lib/server/audit.ts`) |

No secrets or full phone numbers are written to either.

## Background work

- **Companion weekly tips**: Cloud Scheduler → `POST /api/companion/tips` (cron secret).
- **Plan changes**: PayMongo → `POST /api/billing/webhook` (HMAC).
- No other jobs. No Firestore triggers.

## Outbound calls

PayMongo (checkout), the AI provider (Companion), Brevo (notify), Photon/Nominatim (geocode), allowlisted image hosts (logo proxy). All have timeouts; the logo proxy re-checks the redirect target host and caps size at 5 MB.
