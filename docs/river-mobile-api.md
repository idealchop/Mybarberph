# River Mobile partner API (v1)

Base URL: `https://<backend host>/api/river/v1` (dev: `barbers-ph-dev`, prod: `barbers-ph`).

## Auth: River Bridge two-factor (OIDC + HMAC), DEV ONLY for now

Contract: River Partner API v1, `bridge-kit/` + `docs/partner-api/openapi.yaml` + `mapping.md` in
[idealchop/River-Mobile-App PR #3](https://github.com/idealchop/River-Mobile-App/pull/3) (commit `aa192e8`).
The signer/verifier is copied into `src/lib/server/river-bridge/` (canonical, sign, verify, nonce, problems,
idempotency) and wired by `withRiver()` in `src/lib/server/river-bridge/partner.ts`.
The old shared `RIVER_MOBILE_API_KEY` is **retired**: it is not read anywhere.

Every route except `GET /health` needs both factors on the same request:

1. **Caller.** `Authorization: Bearer <Google OIDC ID token>`: issuer `https://accounts.google.com`, RS256,
   `aud` exactly `https://barbers-ph-dev--mybarberph.asia-southeast1.hosted.app` (the dev origin; prod
   audiences `https://barbers-ph--mybarberph.asia-southeast1.hosted.app` and `https://barbersph.web.app` are
   refused), verified `email` = `248617671827-compute@developer.gserviceaccount.com` (River Bridge).
   Local/emulator only (`NODE_ENV` ≠ production): `RIVER_DEV_API_KEY` may replace the token. Never in a
   production build, and HMAC is still required.
2. **Signature.** `X-River-Signature: v1=<hex HMAC-SHA256>` over

   ```text
   v1
   METHOD
   PATH?SORTED_QUERY          (e.g. /api/river/v1/shops?lat=14.5&lng=121)
   X-River-Timestamp          (unix seconds, ±5 min)
   X-River-Nonce              (UUID v4, single use, 10 min)
   hex(SHA-256(raw body))     (empty body = SHA-256 of "")
   ```

   plus `X-River-Key-Id`. Request key ids: `bridge-to-barbers-dev-v1`, `bridge-to-barbers-dev-v2` (both
   active, for rotation). Compared with `crypto.timingSafeEqual` against every active version.

Checks run in this order and stop at the first failure: HTTPS → OIDC → key id → timestamp → nonce →
body hash + HMAC → scope → `Idempotency-Key` (writes). Bodies over **16 KB** → `413`.

Failures are generic `application/problem+json`: `401 unauthorized` (token, key id, timestamp, nonce or
signature) or `403 forbidden` (valid caller, missing scope). The body never says which check failed. Each
attempt writes one server-side audit line to Cloud Logging (`type: river_partner_audit`: time, request id,
key id, caller email, method, path, scope, result, status, reason code). No secrets, tokens or bodies.

**Scopes** (River Bridge SA has all four): `shops:read` (shops, shop, home-service shops/slots),
`orders:read` (get booking), `orders:write` (create, home-bookings, cancel), `checkin:write` (verify,
check-in).

**Idempotency-Key** (8–128 of `A-Za-z0-9_.:-`) is required on every POST: missing/malformed → `400`; the
same key + same body replays the stored response with `Idempotent-Replayed: true`; a different body →
`422 idempotency_key_reused`; a concurrent duplicate → `409`. 5xx responses are not stored.

**Fail closed.** The API is on only when `BARBERS_ENV=dev`, `FIRESTORE_DATABASE_ID=barbersdb-dev` and at least
one request secret is set. Anywhere else (including an accidental prod deploy of this code) every call is
`503 not_configured` and no webhooks are sent.

### Secrets (never in git, logs or chat)
Bound in `apphosting.dev.yaml` only, to Secret Manager ids in `projects/mybarberph` (copied from
`projects/rivermobile-ph/secrets/<same id>`):

| Env var | Secret id | Direction |
| --- | --- | --- |
| `RIVER_BRIDGE_REQUEST_SECRET_V1` | `bridge-to-barbers-dev-v1` | Bridge → Barbers.ph requests |
| `RIVER_BRIDGE_REQUEST_SECRET_V2` | `bridge-to-barbers-dev-v2` | Bridge → Barbers.ph requests |
| `RIVER_BRIDGE_WEBHOOK_SECRET_V1` | `barbers-to-bridge-dev-v1` | Barbers.ph → Bridge webhooks |
| `RIVER_BRIDGE_WEBHOOK_SECRET_V2` | `barbers-to-bridge-dev-v2` | Barbers.ph → Bridge webhooks |

The App Hosting runtime SA `firebase-app-hosting-compute@mybarberph.iam.gserviceaccount.com` needs
`roles/secretmanager.secretAccessor` on each (e.g. `firebase apphosting:secrets:grantaccess <id> --backend barbers-ph-dev --project mybarberph`).

### Server-only stores (configured database; the rules catch-all denies clients)
- `riverNonces/{sha256(keyId, nonce)}`: `create()` per nonce (reuse fails), `expireAt` = +10 min.
- `riverIdempotency/{sha256(caller, method, path, key)}`: body hash + stored response, `expireAt` = +24 h.
- `riverOrders/{orderId}` → `{ shopId }`: written at create so `/orders/{id}/…` finds `shops/{shopId}/bookings/{id}`.

No composite index is needed. Ops step outside the PR (barbersdb-dev only, never `barbersdb`): turn on TTL
deletion so these docs expire:

```bash
gcloud firestore fields ttls update expireAt --collection-group=riverNonces --enable-ttl --database=barbersdb-dev --project=mybarberph
gcloud firestore fields ttls update expireAt --collection-group=riverIdempotency --enable-ttl --database=barbersdb-dev --project=mybarberph
```

Correctness does not depend on TTL (nonce reuse is caught by `create()`); without it the docs just stay.
Do **not** run `firebase deploy --only firestore` for this: those targets include prod.

### Status webhooks (Barbers.ph → Bridge)
On every status change of a River Mobile ticket (`putBooking`, verify/check-in, cancel), the server POSTs a
signed `WebhookEvent` to `https://asia-southeast1-rivermobile-ph.cloudfunctions.net/bridge/hooks/barbers`.
No polling. Factor 1 is this runtime's Google ID token (metadata server) with that exact URL as `aud`;
factor 2 is HMAC with the **webhook** key (`RIVER_WEBHOOK_KEY_ID`, default `barbers-to-bridge-dev-v1`),
same canonical string with path `/bridge/hooks/barbers`. `Idempotency-Key` = event id
(`barbers.{orderId}.{status}`). The first try is awaited (5 s timeout); 5xx/408/429/network errors retry in
the background after 2 s, 10 s and 30 s with a fresh nonce; other 4xx stop. Needs `RIVER_WEBHOOKS_ENABLED=1`
and dev stage. The Bridge must allowlist the runtime SA above as the webhook caller.

```json
{ "id": "barbers.river_mobile-abc.in_progress", "type": "order.in_progress", "occurredAt": "2026-11-23T07:00:00.000Z",
  "data": { "orderId": "river_mobile-abc", "reference": "BK-7KQ2MD", "status": "in_progress", "shopId": "uid", "customerRef": "…" } }
```

Types: `order.accepted`, `order.in_progress`, `order.completed`, `order.declined`, `order.cancelled`. There is no
`order.requested` (the Bridge created the order) and no `order.ready` (Barbers.ph has no such state).

### Status mapping
Internal (`booking.status`): `requested`, `accepted`, `in_chair`, `done`, `declined`, `cancelled`.
Shared (`order.status`): `requested`, `accepted`, `in_progress` (= `in_chair`), `completed` (= `done`),
`declined`, `cancelled`. `cancelled` and `declined` are final: no later write moves them forward, and only
River Mobile can set `cancelled`.

Money is in **centavos** (`95000` = ₱950). Times are epoch milliseconds. Only shops that have set
a name and at least one service (`listed`) are visible.

## Endpoints

### `GET /health` (no auth)
`200 { "status": "ok", "apiVersion": "v1" }`.

### `GET /shops?lat=&lng=&radiusKm=25&limit=50`
Listed shops. With `lat`/`lng`: only pinned shops within `radiusKm` (max 200), nearest first, with `distanceKm`.

```json
{ "shops": [ { "id": "uid", "name": "", "address": "", "area": "", "phone": "", "about": "",
  "hours": "Mon–Sat 9 AM–8 PM", "location": { "lat": 14.55, "lng": 121.02, "formattedAddress": "…" },
  "photoUrls": ["https://firebasestorage.googleapis.com/..."], "logoUrl": null, "branches": [],
  "services": [ { "id": "haircut", "name": "Haircut", "durationMins": 30, "price": 25000, "kind": "haircut" } ],
  "plan": "partner", "updatedAt": 0, "distanceKm": 1.2 } ] }
```

### `GET /shops/{shopId}`
One shop profile (same shape). `404` if missing or unlisted.

### `POST /shops/{shopId}/bookings` (`orders:write`, Idempotency-Key)
Creates a booking ticket with `source: "river_mobile"`. It shows in the shop's Queue → Online as `requested`.
Also accepts the contract's `customer: { ref, name, phoneE164 }` (name/phone fill `customerName`/`contact`;
`ref` is kept and sent back on webhooks) and `externalRef` (alias of `externalId`).

```json
{ "customerName": "Ana", "contact": "+639171234567", "serviceIds": ["haircut"],
  "slotLabel": "Today 3:00 PM", "locationId": "optional-branch-id", "externalId": "river-booking-123" }
```
`customerName` is required. `serviceIds` defaults to the first service. Response `201`:
```json
{ "booking": { "id": "river-…", "shopId": "uid", "ref": "BK-7KQ2MD", "status": "requested",
  "serviceName": "Haircut", "price": 25000, "paid": false, "verifiedAt": null, "createdAt": 0, "updatedAt": 0 },
  "order": { "orderId": "river_mobile-…", "shopId": "uid", "reference": "BK-7KQ2MD", "status": "requested",
  "source": "river_mobile", "totalCentavos": 25000, "currency": "PHP", "updatedAt": "…" } }
```
Payment is always at the chair for River bookings. No payment is taken through this API.

### `GET /shops/{shopId}/bookings/{id}` (`orders:read`)
`{ booking, order }`. `booking.status`: `requested` → `accepted` → `in_chair` → `done`, or `declined` /
`cancelled`; `order.status` is the shared status. Only River Mobile tickets (`source` `river_mobile`, or the
older `river`) are returned.

### `POST /shops/{shopId}/verify` (`checkin:write`, Idempotency-Key)
Partner Scan / check-in: verify a ticket code at the shop.
Body `{ "code": "BK-7KQ2MD" }`. Returns `200 { "ok": true, "booking": {…} }` and sets `verifiedAt`; a
`requested` booking becomes `accepted`. Returns `404 {"ok":false,"reason":"not_found"}` or `409 … "declined"` / `"cancelled"`.
Shop owners can also verify in the app (Queue → Find ticket), which calls `/api/shop/verify`.

### `POST /orders/{id}/cancel` (`orders:write`, Idempotency-Key)
Body `{ "reason"?: string (≤200), "shopId"?: string }`. Customer cancel while `requested` or `accepted`:
`200` Order (`status: "cancelled"`, plus `booking`). Already cancelled → `200` (same). Started, done or
declined → `409 conflict`. Unknown → `404`. The booking is found through `riverOrders/{id}`; tickets created
before this release need the `shopId` hint. Frees the slot, notifies the owner, sends `order.cancelled`.

### `POST /orders/{id}/check-in` (`checkin:write`, Idempotency-Key)
Body `{ "code"?: "BK-…", "shopId"?: string }`. Same as `/shops/{shopId}/verify` with the ticket reference
as the code. `200` Order; `409` if the code doesn't match, or the ticket is cancelled/declined; `404` unknown.

Home-service routes (`/home-service/shops`, `/shops/{shopId}/home-service/slots` with `shops:read`;
`/shops/{shopId}/home-bookings` with `orders:write` + Idempotency-Key) work as in
[river-mobile-home-service.md](./river-mobile-home-service.md), behind the same two factors.

## Errors
Auth/idempotency/size: `application/problem+json` `{ type, title, status, code }` with `401 unauthorized`,
`403 forbidden`, `400 invalid_request`, `413 payload_too_large`, `422 idempotency_key_reused`, `409 conflict`,
`503 not_configured`. Business validation on the older routes keeps `{ "error", "code" }` with `400`/`404`.
