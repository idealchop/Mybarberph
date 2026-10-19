# Firestore schema

Project `mybarberph`. Two named databases with the same layout: **`barbersdb-dev`** (DEV) and **`barbersdb`** (PROD), chosen by `FIRESTORE_DATABASE_ID` (`src/lib/firebase/admin.ts`). Only the server (Admin SDK) reads and writes; `firestore.rules` closes all client writes. Amounts are **centavos** (integers) unless noted. Times are epoch **ms**.

Tenant key: `shopId` = owner's Firebase Auth uid. Everything a shop owns lives under `shops/{shopId}`.

## `shops/{shopId}` — shop profile + plan (`ShopDoc`, `src/lib/server/shops.ts`)

| Field | Type | Notes |
| :--- | :--- | :--- |
| `ownerUid` | string | = `shopId` |
| `plan` | `partner` \| `pro_499` \| `lifetime_5` \| `lifetime_unlimited` (+ legacy `monthly_950`, `lifetime_10000`) | Server-set only (billing webhook) |
| `planStatus` | `active` \| `pending` \| `expired` | |
| `planRenewsAt` | number \| null | Lapsed recurring plans fall back to Partner (`effectivePlan`) |
| `name`, `address`, `area`, `phone`, `about`, `hours` | string | Public profile (mirrored from the `profile` state) — `phone` is the shop's business number |
| `hoursWeek` | WeekHours \| null | Structured opening hours |
| `location` | `{ lat, lng, formattedAddress }` \| null | Map pin |
| `photoUrls`, `logoUrl` | string[] / string | Public Storage download URLs |
| `branches` | `{ id, name, address, area, location }[]` | Multiple shops (≤ 20) |
| `menu`, `menuByLocation` | service list (`id, name, durationMins, price, kind, icon`) | |
| `homeService` | HomeServiceFile | River Mobile home service settings |
| `listed` | boolean | Public/partner visibility (rules allow public read only when true) |
| `createdAt`, `updatedAt` | number | |

## `shops/{shopId}/private/{doc}` — owner app state (JSON blob in field `json`)

Doc ids from `STATE_KEYS`: `profile` (`barbers.shop-profile`), `menu` (`barbers.shop-menu`), `chairs` (`barbers.shop-chairs`: barbers/seats, link tokens, expiry, active flag), `locations` (`barbers.shop-locations`), `community` (`barbers.community.v1`), `home` (`barbers.home-service`). Also `remitLock` (`{ at, last }`) which serialises remit claims. Written only by `PUT /api/shop/state/:key` (owner). Barber links may write none (`BARBER_KEYS` is empty).

## `shops/{shopId}/bookings/{id}` — visits (`ChairRequest`, `src/lib/booking-types.ts`)

| Field | Notes |
| :--- | :--- |
| `id`, `shopId`, `ref` | `ref` = short ticket code shown to the customer (`src/lib/ticket-code.ts`) |
| `channel` | `walk-in` \| `online` |
| `status` | `requested` → `accepted` → `in_chair` → `done`, or `declined` |
| `contact`, `customerLabel` | **PII**: customer phone/email and name as given at booking |
| `serviceId`, `serviceName`, `price` | price in centavos |
| `slotLabel`, `scheduledAt`, `chairLabel`, `seatLabel`, `locationId` | Queue/seat info. Missing `locationId` = first shop (`home`) |
| `payWhere` | `online` \| `shop` |
| `paid`, `payMethod` | `payMethod`: `cash` \| `gcash` \| `online`. The server fills a missing method on save (`online` for online pay, else `cash`); older visits may have none and are shown as **Other** in Sales |
| `payPref` | customer's stated preference at booking (`cash` \| `gcash`) |
| `barberId`, `barberName` | snapshot of who did the cut (salary/remit) |
| `startedAt`, `completedAt`, `verifiedAt` | timeline |
| `rating` (1–5), `feedback`, `feedbackAt` | customer feedback (PII-light free text) |
| `home`, `homeFee`, `homeStatus` | River Mobile home service: **PII** address + coordinates |
| `source`, `externalId` | origin (`qr` = shop QR page, `river` = River Mobile) and partner id |
| `notes` | owner note |
| `createdAt`, `updatedAt` | |

Queries: `orderBy(createdAt desc).limit(300)` (owner snapshot), `where(createdAt >= from).limit(5000 | 20000)` (sales rows, field-trimmed), `where(status == done).select(...).limit(8000)` (remit), `where(ref == X).limit(1)` (verify). All are single-field, so `firestore.indexes.json` has no composite indexes.

## `shops/{shopId}/activity/{id}` — audit trail (`ActivityEntry`, `src/lib/server/activity.ts`)

`{ id, at, type, text, actor: { name, role }, locationId?, amount?, ref?, … }`. Written by `logActivity()` after every booking, state, remit, QR-verify, feedback and plan change. Types include `walkin_added`, `booking_added`, `booking_requested`, `booking_accepted`, `booking_declined`, `cut_started`, `cut_completed`, `payment_changed`, `booking_deleted`, `barber_added/edited/removed/activated/deactivated`, `service_added/edited/removed`, `location_added/edited/removed`, `shop_edited`, `remit_claimed`, `qr_scanned`, `feedback`, `plan_changed`. Shown to the owner on Settings → Activity.

## `shops/{shopId}/notifications/{id}`

Same shape as activity plus `read: boolean`. Owner bell; newest 50 listed. A daily `remit-YYYY-MM-DD` doc reminds about unclaimed cash.

## `shops/{shopId}/remitClaims/{id}` (`RemitClaim`, `src/lib/server/remit.ts`)

`{ id, barberId, barberName, locationId, amount, bookingIds[], from, to, claimedAt, claimedBy }`. Written in a transaction with `private/remitLock`, so a double tap can't claim twice.

## `shops/{shopId}/companion/*` and `insights/{weekId}` — AI Companion (`src/lib/server/companion/companion.ts`)

`companion/memory` (goals and facts), `companion/thread` + `thread/messages/{id}` (`{ id, role: user|assistant|tip|alert, text, createdAt, weekId?, locked? }`), `companion/usage-{weekId}` (Gemini tokens + cost), `companion/quota-{YYYY-MM}` (Partner question count), `insights/{weekId}` (Monday tips). Owner-only read in rules; server-only write.

## `chairLinks/{token}` — barber links (server-only)

`{ shopId, chairId, expiresAt }`. Token = `[a-z0-9]{8,40}`, rebuilt from the `chairs` state on each save; links past `expiresAt` resolve to 404.

## `community_posts/{id}` — shared community feed (cross-tenant by design)

`{ shopId, author, body (≤ 2000), images (≤ 4 https URLs), createdAt, likedBy[], repostedBy[], replies[{ id, author, body, createdAt }] }`. The one intentional cross-shop surface: any signed-in owner can read the newest 60, post, like, repost and reply; only the author shop can delete. Mutations emit `auditLog` lines.

## Storage — bucket `mybarberph-shop-photos`

`shops/{shopId}/photos/{time}-{rand}.{jpg|png|webp}` — public read, uploaded only via `POST /api/shop/photos` (owner, ≤ 5 MB, JPEG/PNG/WebP).

## PII summary

Customer `contact`/`customerLabel`, `home.address`/coordinates, feedback text, owner's Firebase identity (`ownerUid`). Tenant-scoped under `shops/{shopId}`; never on indexable pages; not written to logs (`auditLog` carries ids only). No export/delete endpoint exists yet; retention is not defined (open item).
