# Architecture overview

## Shape

**Shape A — monorepo FE + API, single-app variant.** One git repo (`idealchop/Mybarberph`), one Next.js 16 app (App Router, React 19, Node 22) deployed to Firebase App Hosting. The frontend and the backend ship together in one build:

| Layer | Lives in | Owns |
| :--- | :--- | :--- |
| Frontend | `src/app/**/page.tsx`, `src/features/*`, `src/components/*`, `src/lib/*` (client) | UI, local UI state, reads through the API |
| Backend | `src/app/api/**/route.ts` (route handlers), `src/lib/server/*`, `src/lib/firebase/admin.ts` | All Firestore/Storage reads and writes (Admin SDK), audit, AI, webhooks, partner API |

Deviation from the shape-A template (`frontend/` + `backend/functions/` packages): this repo is one package and the API runs as Next route handlers, not Cloud Functions. Every server module imports `server-only`, so the build fails if one is pulled into a client bundle. Splitting into packages is an open item that needs Jimboy's decision (see the compliance report).

## Responsibility split (the FE/BE law)

- The browser loads **Firebase Auth only** (`src/lib/firebase/client.ts`, `src/lib/session.ts`). There is no client Firestore, Storage or Realtime Database SDK in the bundle.
- Every business write goes `component → api() (src/lib/cloud.ts) → /api/... route → src/lib/server/* service → Admin SDK`.
- Firestore and Storage security rules deny all client writes (`firestore.rules`, `storage.rules`). Reads are owner-only where they are allowed at all; the app does not use them.
- Every mutation domain has a paired GET (see [api-reference.md](./api-reference.md#paired-gets)).

## Data flow

```
React component / hook (src/features/{domain})
  → api(path, init)            src/lib/cloud.ts  (adds Authorization: Bearer <Firebase ID token>)
  → route handler              src/app/api/.../route.ts  (auth: getCaller / chairLink / riverAuth / HMAC)
  → service                    src/lib/server/{shops,activity,remit,barber-sales,home-service,companion}.ts
  → Firestore / Storage        Admin SDK, database FIRESTORE_DATABASE_ID (barbersdb-dev | barbersdb)
  → audit                      logActivity()/bookingActivity() → shops/{shopId}/activity (+ notifications)
                               auditLog() → structured Cloud Logging line (community, photos)
UI refresh: the hook re-fetches its GET after the mutation, plus visibility-gated polling (hybrid-read-model.md).
```

## Multitenancy key

`shopId` = the owner's Firebase uid, taken from the verified ID token (`getCaller` in `src/lib/server/auth.ts`). Owner routes never accept a shop id from the client. Barber links resolve `shopId` server-side from `chairLinks/{token}`. Partner routes take `shopId` from the path but only after the API key check, and only for listed shops (see [workspace-roles-and-permissions.md](./workspace-roles-and-permissions.md)).

## Dual endpoint example (bookings)

| Mutation | Paired read |
| :--- | :--- |
| `PUT /api/shop/bookings/:id`, `DELETE /api/shop/bookings/:id` | `GET /api/shop` (`bookings`), `GET /api/shop/sales-rows` |
| `POST /api/public/bookings` | `GET /api/public/bookings/:id` |

## Stack

Next.js 16.3, React 19.2, TypeScript, Tailwind, `@river-apps/ui` (vendored UI kit, git submodule `vendor/river-apps-ui-kit`), MapLibre + River Maps style, Firebase Auth (web), firebase-admin 14 (Firestore, Storage, Auth), Vertex AI Gemini for the Companion (server only), PayMongo (checkout + webhook), Brevo (SMS/email). Validation is hand-written at each route boundary (`cleanBooking`, `str`, `urls`, key allow-lists) rather than Zod; see the compliance report.

## Security headers

`next.config.ts` sets on every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `Permissions-Policy` (camera/geolocation self only). A Content-Security-Policy is not set yet (open item).
