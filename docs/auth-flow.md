# Auth flow

## Owners (shop accounts) — Firebase Auth

The browser loads only the Firebase Auth web SDK (`src/lib/firebase/client.ts`, `src/lib/session.ts`). No Firestore/Storage client SDK is used.

1. **Guest first.** `/` → `/home` works signed out. Actions that need an account (`data-auth="action"`) open the sign-in sheet (`requireAuth`).
2. **Sign-in methods**
   - **Google**: `signInWithPopup`; when the popup is blocked or unsupported (mobile Safari, in-app browsers) it falls back to `signInWithRedirect`, keeping the return path in `sessionStorage["bp.authRedirect"]` (removed after `getRedirectResult`). With `NEXT_PUBLIC_AUTH_SAME_ORIGIN=1` on `*.hosted.app` / `*.web.app`, the auth domain is the current host so the redirect handler is same-origin.
   - **Phone (SMS OTP)**: `signInWithPhoneNumber` with an invisible reCAPTCHA, then `confirmPhoneCode`.
   - **Test mode (DEV only)**: when `NEXT_PUBLIC_AUTH_TEST_MODE=1` *and* the browser has opted in with `localStorage["bp.authTest"]="1"`, reCAPTCHA is skipped so Firebase **test phone numbers** can sign in for automated checks. Real numbers still need reCAPTCHA. It is set in `apphosting.dev.yaml` only (open item: whether to keep it on hosted DEV).
3. **Calling the API.** `api()` in `src/lib/cloud.ts` adds `Authorization: Bearer <Firebase ID token>` (`getIdToken()`, refreshed by the SDK).
4. **Server check.** `getCaller(req)` (`src/lib/server/auth.ts`) verifies the token with `adminAuth().verifyIdToken`. Invalid or missing → `401 { code: "unauthenticated" }`. The caller's `uid` is the tenant (`shopId`); `ensureShop(uid)` creates an empty `shops/{uid}` on first use.
5. **Sign-out.** `signOut()` (Firebase). No server session or cookie is used (`SESSION_COOKIE_NAME` in `apphosting.yaml` is unused).

## Barbers — chair links (no account)

The owner gives each barber a link `/b/{token}`. Tokens (`[a-z0-9]{8,40}`) live on the chair in the `chairs` state and are mirrored to `chairLinks/{token} = { shopId, chairId, expiresAt }` on each save. `chairLink(token)` resolves the shop server-side; an unknown, replaced or expired token returns `404 { code: "not_found" }`. The link is a capability: anyone with it acts as that barber for that one shop.

## Customers — no account

Booking (`POST /api/public/bookings`) needs no sign-in. The customer keeps their ticket id (stored in the browser's `localStorage` per shop, so a refresh finds the ticket again). The unguessable booking id is the capability for `GET /api/public/bookings/:id` and feedback.

## River Mobile (partner) — API key

`/api/river/v1/*` requires `x-api-key` (or `Authorization: Bearer`) equal to `RIVER_MOBILE_API_KEY`, compared with `timingSafeEqual` (`src/lib/server/river.ts`). Unset key → `503 not_configured`; wrong key → `401 unauthenticated`.

## System callers

- **PayMongo webhook** `POST /api/billing/webhook`: HMAC-SHA256 over `t.rawBody` with `PAYMONGO_WEBHOOK_SECRET` (`paymongo-signature` header), constant-time compare. Unsigned/bad → `401`.
- **Companion tips cron** `POST /api/companion/tips`: `COMPANION_CRON_SECRET` as `Bearer` or `x-companion-cron`, constant-time compare.

## Authorized domains

Firebase Auth authorized domains must include the hosted DEV/PROD hosts (`barbers-ph-dev--mybarberph.asia-southeast1.hosted.app`, `barbers-ph--mybarberph.asia-southeast1.hosted.app`, `barbersph.web.app`). Check these in the Firebase console before changing hosts.
