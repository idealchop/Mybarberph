# Roles and permissions

Barbers.ph has no staff accounts. A shop is owned by one Firebase user; barbers act through chair links. Enforcement is on the server; the UI only hides what a role can't do.

| Role | Identity | Tenant resolution |
| :--- | :--- | :--- |
| **Owner** | Firebase ID token | `shopId = uid` from the verified token |
| **Barber** | Chair link token `/b/{token}` | `chairLinks/{token}.shopId` (server) |
| **Customer** | none (booking id = capability) | `shopId` in the booking/shop URL, public data only |
| **River partner** | `RIVER_MOBILE_API_KEY` | `shopId` path param; listed shops only |
| **System** | PayMongo HMAC / cron secret | from signed metadata (`meta.shopId`) or job input |

## Matrix

| Action | Owner | Barber link | Customer | River partner | System |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Read own shop, state, bookings (`GET /api/shop`) | ✅ | own visits only (+ open ones waiting at their location), menu, chairs (`GET /api/barber/:token`) | ❌ | ❌ | — |
| Save app state (profile, menu, chairs, locations, community prefs, home service) | ✅ `PUT /api/shop/state/:key` | ❌ (`BARBER_KEYS` empty → 400) | ❌ | ❌ | — |
| Create/update booking | ✅ `PUT /api/shop/bookings/:id` | ✅ own visits only (another barber's → 404); server stamps the barber and location, and saves the menu price whatever was sent (`PUT /api/barber/:token/bookings/:id`) | create only (`POST /api/public/bookings`) | create (`POST …/bookings`, `…/home-bookings`) | — |
| Delete booking | ✅ | ❌ | ❌ | ❌ | — |
| Verify ticket code | ✅ `POST /api/shop/verify` | — | — | ✅ `POST …/verify` | — |
| Sales, performance, activity, notifications | ✅ | own sales/performance only | ❌ | ❌ | — |
| Claim remit (mark cash received) | ✅ | ❌ (sees claims) | ❌ | ❌ | — |
| Change a visit's amount | ✅ any amount | ❌ always the menu price (+ home fee) | — | — | — |
| Reset / confirm a barber link | ✅ Barber detail › Reset link; 6-month "Keep {name}'s link active?" | ❌ | — | — | — |
| Change barber's own name | owner via chairs state | ❌ (`PUT /api/barber/:token/name` → 403 forbidden) | — | — | — |
| Upload shop photo | ✅ | ❌ | ❌ | ❌ | — |
| Community feed (shared across shops) | read, post, like, repost, reply; delete **own** posts | ❌ | ❌ | ❌ | — |
| Companion (AI) | ✅ when `COMPANION_ENABLED=1` | ❌ | ❌ | ❌ | weekly tips (cron) |
| Plan checkout | ✅ | ❌ | ❌ | ❌ | plan change via signed webhook |
| Read public shop / barbers | ✅ | ✅ | ✅ (listed shops) | ✅ (listed shops) | — |
| Read own booking status, leave feedback | — | — | ✅ by booking id | read by id | — |

Platform admin: **none**. There is no cross-tenant admin route. The only cross-tenant data is the community feed (by design) and the public listing of `listed` shops.

## Tests

Tenant and role negatives: `TC-TENANT-NEG-01` (owner can't write another shop's state by sending a shop id), `TC-AUTH-NEG-01/02`, `TC-BARBER-NEG-01/02` (barber can't write state or rename), `TC-BARBER-NEG-03/04` (can't read or write another barber's visits), `TC-BARBER-NEG-05` (can't change the amount), `TC-RIVER-NEG-01/02`, `TC-BILL-NEG-01/02`, `TC-CRON-NEG-01`. See [testing/test-plan.md](./testing/test-plan.md).
