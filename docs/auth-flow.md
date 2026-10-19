# Auth flow

## Owners (shop accounts) — Firebase Auth

The browser loads only the Firebase Auth web SDK (`src/lib/firebase/client.ts`, `src/lib/session.ts`). No Firestore/Storage client SDK is used.

1. **Guest first.** `/` → `/home` works signed out. Actions that need an account (`data-auth="action"`) open the sign-in sheet (`requireAuth`).
   - **Opens once per visit (2026-10-20).** A signed-out visitor on a shop-app page (Home, Queue, Sales, Settings…) sees the sign-in sheet by itself once per page load (`src/lib/auto-login.ts`). It is dismissable and guest browsing keeps working. It never opens on booking/schedule (`/book`), the customer ticket, barber links (`/b/…`), Moments, privacy, terms or map credits, nor while "Signing you in…" (Google redirect return).
   - **No email/password sign-in.** The sheet offers Google and a text code only, so there is no "Forgot password?" link (it would need an email/password method first; open item).
2. **Sign-in methods**
   - **Google**: `signInWithPopup`; when the popup is blocked or unsupported (mobile Safari, in-app browsers) it falls back to `signInWithRedirect`, keeping the return path in `sessionStorage["bp.authRedirect"]` (removed after `getRedirectResult`). With `NEXT_PUBLIC_AUTH_SAME_ORIGIN=1` on `*.hosted.app` / `*.web.app`, the auth domain is the current host so the redirect handler is same-origin.
   - **Phone (SMS OTP)**: `signInWithPhoneNumber` with an invisible reCAPTCHA, then `confirmPhoneCode`.
   - **Test mode (DEV only)**: when `NEXT_PUBLIC_AUTH_TEST_MODE=1` *and* the browser has opted in with `localStorage["bp.authTest"]="1"`, reCAPTCHA is skipped so Firebase **test phone numbers** can sign in for automated checks. Real numbers still need reCAPTCHA. It is set in `apphosting.dev.yaml` only (open item: whether to keep it on hosted DEV).
3. **Settings › Account** (`/settings/account`). Shows how the owner signs in: "You sign in with Google" or "You sign in with a text code", with no password form. An account that has an email password (`password` provider) gets **Change password**: current, new (≥ 8 characters) and confirm. It re-authenticates with the current password (`reauthenticateWithCredential`), then calls `updatePassword`. Errors: wrong password, weak password, requires-recent-login.
4. **Calling the API.** `api()` in `src/lib/cloud.ts` adds `Authorization: Bearer <Firebase ID token>` (`getIdToken()`, refreshed by the SDK).
5. **Server check.** `getCaller(req)` (`src/lib/server/auth.ts`) verifies the token with `adminAuth().verifyIdToken`. Invalid or missing → `401 { code: "unauthenticated" }`. The caller's `uid` is the tenant (`shopId`); `ensureShop(uid)` creates an empty `shops/{uid}` on first use.
6. **Sign-out.** `signOut()` (Firebase). No server session or cookie is used (`SESSION_COOKIE_NAME` in `apphosting.yaml` is unused).

## Barbers — chair links (no account)

The owner gives each barber a link `/b/{token}`. Tokens (`[a-z0-9]{8,40}`) live on the chair in the `chairs` state and are mirrored to `chairLinks/{token} = { shopId, chairId }` on each save. `chairLink(token)` resolves the shop server-side; an unknown, replaced or turned-off token returns `404 { code: "not_found" }` with "This link was replaced or turned off." The link is a capability: anyone with it acts as that barber for that one shop.

**Links never expire (Jimboy's accepted decision, 2026-10-19).** The same token keeps working until the owner turns the barber off (or removes the chair); the server has no expiry check and the app never rotates a token on its own.

- **6-month review (nudge only).** Each chair has `linkReviewAt` (6 months after the link was made or last confirmed). When it is due, the owner sees "Keep {name}'s link active?" with **Confirm** on the barber's detail page, in Manage Shop › Barbers, and a "Barber links to review · N" notice in Settings. Confirm sets the next review 6 months out. If the owner never confirms, nothing happens: the link keeps working.
- **Turn off.** Turning the barber off on their detail page (Active switch, `active: false`) stops the link at once; turning them back on restores it. There is no separate Reset link button (removed on Jimboy's request, 2026-10-20).
- **Migration.** Old chairs with `linkExpiresAt` are read as `linkReviewAt` (no link breaks); old `chairLinks` docs with `expiresAt` still resolve, and the field is dropped on the next save.

**What a link can see and change.** A barber link only sees and edits that barber's own visits (`barberAccess`, `src/lib/server/shops.ts`):

- *own*: `barberId` is this barber; on old rows with no `barberId`, the visit's chair/seat is this barber's chair at their location;
- *open*: an unassigned visit still waiting (`requested`/`accepted`, no chair) at the barber's location, so the shared Waiting → Accept flow keeps working. The first save stamps the barber, and from then on it is theirs only.

Anything else is hidden from `GET /api/barber/:token` and a `PUT` answers `404`. The amount a link saves is always the menu price (server-enforced); only the owner can change it.

## Customers — no account

Booking (`POST /api/public/bookings`) needs no sign-in. The customer keeps their ticket id (stored in the browser's `localStorage` per shop, so a refresh finds the ticket again). The unguessable booking id is the capability for `GET /api/public/bookings/:id` and feedback.

## River Mobile (partner) — API key

`/api/river/v1/*` requires `x-api-key` (or `Authorization: Bearer`) equal to `RIVER_MOBILE_API_KEY`, compared with `timingSafeEqual` (`src/lib/server/river.ts`). Unset key → `503 not_configured`; wrong key → `401 unauthenticated`.

## System callers

- **PayMongo webhook** `POST /api/billing/webhook`: HMAC-SHA256 over `t.rawBody` with `PAYMONGO_WEBHOOK_SECRET` (`paymongo-signature` header), constant-time compare. Unsigned/bad → `401`.
- **Companion tips cron** `POST /api/companion/tips`: `COMPANION_CRON_SECRET` as `Bearer` or `x-companion-cron`, constant-time compare.

## Authorized domains

Firebase Auth authorized domains must include the hosted DEV/PROD hosts (`barbers-ph-dev--mybarberph.asia-southeast1.hosted.app`, `barbers-ph--mybarberph.asia-southeast1.hosted.app`, `barbersph.web.app`). Check these in the Firebase console before changing hosts.
