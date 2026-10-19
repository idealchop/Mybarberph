# API reference

All routes are Next.js route handlers under `src/app/api` (one deployable; see [backend-documentation.md](./backend-documentation.md)). JSON in, JSON out. Times are epoch **ms**; money is whole **₱ pesos**.

## Errors

Every error is `{ "error": "<human message>", "code": "<ErrorCode>" }` (`apiError` in `src/lib/server/auth.ts`). Extra fields are allowed (e.g. `limit` on `plan_limit`).

| code | HTTP | When |
| :--- | :--- | :--- |
| `unauthenticated` | 401 | Missing/invalid ID token, partner key, webhook signature or cron secret |
| `forbidden` | 403 | Authenticated but not allowed (e.g. barber renaming self, deleting another shop's post) |
| `bad_request` | 400 | Invalid body, key or params |
| `not_found` | 404 | Unknown shop, booking, chair link; feature off |
| `conflict` | 409 | Reserved (no route returns it today) |
| `rate_limited` | 429 | Reserved. Companion quota is a 200 with `limited: true` and the `quota` object, so the UI can show the upgrade prompt |
| `plan_limit` | 402 | Plan limit reached (`limit: "walk-ins"`) |
| `not_configured` | 503 | Server secret not set (partner key, PayMongo, AI) |
| `upstream_error` | 502 | PayMongo / AI / map provider failed (details logged server-side only) |
| `internal` | 500 | Unexpected |

## Pagination and limits

| Route | Shape |
| :--- | :--- |
| `GET /api/shop/activity` | `?before=<ms>` cursor, ≤ 50 per page (default 30); filters `loc, role, actor, type` |
| `GET /api/companion/messages` | `?before=<createdAt ms>&limit=` (1–100, default 30) |
| `GET /api/community` | newest 60 posts |
| `GET /api/river/v1/shops` | `?limit=` ≤ 100 (default 50), of up to 500 listed shops; `lat,lng,radiusKm` |
| `GET /api/shop/sales-rows` | `?days=` 1–3650 (default 28), `?full=1` for whole docs; capped at 5,000 rows (20,000 when `days > 124`). Aggregation input, not a UI list (justified exception) |
| `GET /api/shop/remit-claims` | up to 8,000 done visits (aggregation, justified exception) |
| `GET /api/barber/:token` | newest 150 bookings |

## Owner (Firebase ID token, `Authorization: Bearer`)

| Method & path | Purpose | Paired read |
| :--- | :--- | :--- |
| `GET /api/shop` | Shop state (all keys), today's bookings, plan | — |
| `PUT /api/shop/state/:key` | Save one state key (`profile, services, chairs, locations, …`). Body `{ value }`. Writes activity on diffs | `GET /api/shop` |
| `PUT /api/shop/bookings/:id` | Create/update a booking (status, payment). 402 `plan_limit` for walk-ins over plan | `GET /api/shop`, `GET /api/shop/sales-rows` |
| `DELETE /api/shop/bookings/:id` | Delete a booking | `GET /api/shop` |
| `POST /api/shop/verify` | Verify a customer ticket code | — |
| `GET /api/shop/sales-rows` | Visit rows for Sales | — |
| `GET /api/shop/performance` | `?range=&loc=` | — |
| `GET /api/shop/barber-sales` | `?range=&from=&to=&loc=` | — |
| `GET, POST /api/shop/remit-claims` | Cash to claim per barber / mark claimed | GET is the pair |
| `GET, POST /api/shop/notifications` | List (`?count=1` for badge) / mark read | GET is the pair |
| `GET /api/shop/activity` | Audit log | — |
| `POST /api/shop/photos` | Upload a shop photo (multipart, ≤ 5 MB, image types) → public URL | `GET /api/shop` (`profile.photos`) |
| `GET, POST /api/community` | Cross-shop feed: list / `post, like, repost, reply, delete` (own posts only) | GET is the pair |
| `POST /api/billing/checkout` | Start PayMongo checkout → `{ url }` | `GET /api/billing/status`, `GET /api/shop` (plan) |
| `POST /api/companion/chat`, `GET /api/companion/messages`, `POST /api/companion/weekly` | AI companion (only when `COMPANION_ENABLED=1`, else 404) | `GET /api/companion/messages` |

## Barber (chair link token in path)

| Method & path | Purpose |
| :--- | :--- |
| `GET /api/barber/:token` | Shop name, menu, chairs, locations, newest 150 bookings |
| `PUT /api/barber/:token/bookings/:id` | Update/create a booking in that shop; server stamps `barberId` and location from the chair |
| `GET /api/barber/:token/sales` | `?range=` own sales |
| `GET /api/barber/:token/performance` | `?range=&from=&to=` own performance |
| `PUT /api/barber/:token/state/:key` | No keys allowed today → 400 |
| `PUT /api/barber/:token/name` | Always 403 `forbidden` (owner renames) |

## Public (no auth)

| Method & path | Purpose |
| :--- | :--- |
| `GET /api/public/shops/:shopId` | Public profile + menu of a shop |
| `GET /api/public/shops/:shopId/barbers` | Public barber list |
| `POST /api/public/bookings` | Customer books / joins queue → `{ booking }` |
| `GET /api/public/bookings/:id` | Ticket status (id is the capability) — paired read of the POST |
| `POST /api/public/bookings/:id/feedback` | Rating/comment after a visit |
| `GET /api/public/logo-proxy?url=` | Same-origin image proxy for allowlisted hosts (redirect target re-checked, ≤ 5 MB, 8 s) |
| `GET /api/geocode?q=&lat=&lng=` | Place search (Photon → Nominatim), PH only, cached 10 min |
| `GET /api/billing/status` | `{ paymongo: boolean }` |

## River Mobile partner (`x-api-key`)

`GET /api/river/v1/shops`, `GET /api/river/v1/shops/:shopId`, `POST /api/river/v1/shops/:shopId/bookings`, `GET /api/river/v1/shops/:shopId/bookings/:id` (pair of the POST), `POST /api/river/v1/shops/:shopId/home-bookings`, `GET /api/river/v1/home-service/shops`, `GET /api/river/v1/shops/:shopId/home-service/slots?date=`, `POST /api/river/v1/shops/:shopId/verify`. Contract details for River Mobile: [river-mobile-api.md](./river-mobile-api.md).

## System

| Method & path | Auth |
| :--- | :--- |
| `POST /api/billing/webhook` | PayMongo HMAC signature |
| `POST /api/companion/tips` | `COMPANION_CRON_SECRET` |
