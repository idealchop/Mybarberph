# Environments

One Firebase / GCP project, **`mybarberph`** (region `asia-southeast1`), two App Hosting backends and two named Firestore databases.

| | DEV | PROD |
| :--- | :--- | :--- |
| App Hosting backend | `barbers-ph-dev` | `barbers-ph` |
| URL | https://barbers-ph-dev--mybarberph.asia-southeast1.hosted.app | https://barbers-ph--mybarberph.asia-southeast1.hosted.app, https://barbersph.web.app (Hosting site `barbersph` rewrites to Cloud Run `barbers-ph`) |
| Env overlay | `apphosting.dev.yaml` | `apphosting.prod.yaml` |
| Firestore DB | `barbersdb-dev` | `barbersdb` |
| Storage bucket | `mybarberph-shop-photos` (shared; objects under `shops/{shopId}/`) | same |
| `BARBERS_ENV` | `dev` | `prod` |
| Crawling | `robots.txt` disallows all | allows `/`, disallows `/api/`; pages `noindex` |
| Auth test numbers | `NEXT_PUBLIC_AUTH_TEST_MODE=1` | off |
| Companion (AI) | `COMPANION_ENABLED=1` | off |
| Plan limits | `PLAN_LIMITS_ENABLED=0` | `0` |
| Brevo notify | `BREVO_API_KEY` secret | `BREVO_API_KEY` secret |

Shared values (Firebase web config, storage bucket, map style) are in `apphosting.yaml`. Every variable name and purpose is listed in [`env.example`](../env.example).

**Not in the committed config:** `RIVER_MOBILE_API_KEY`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` are commented out in `apphosting.yaml`. Without them the partner API answers `503 not_configured` and checkout is unavailable. Whether they are set in the console for either backend is not verifiable from the repo.

## Branches → environments

The rulebook's model is `dev` branch → DEV, `main` → PROD. Today there is no `dev` branch (only `main` and an old `feat/firebase`), and releases are done from the local tree with the Firebase CLI. Whether a backend also has automatic GitHub rollouts turned on couldn't be checked (the gcloud/firebase login has expired). Creating a `dev` branch and wiring rollouts is an open item for Jimboy.

## Deploy

```bash
export PATH=$HOME/.local/node22/bin:$PATH
# DEV (from a clean tree; retry on HTTP 409 "operation in progress")
firebase deploy --only apphosting:barbers-ph-dev --project mybarberph
# PROD — only with Jimboy's explicit approval
firebase deploy --only apphosting:barbers-ph --project mybarberph
```

`firebase.json` `apphosting.ignore` keeps `.secret*`, `.env*`, logs, screenshots and vendor tooling out of the upload.

Firestore/Storage rules: `firebase deploy --only firestore:rules,storage --project mybarberph` deploys the same `firestore.rules` to **both** databases, so it needs approval (it touches PROD).

## Local

```bash
npm ci && git submodule update --init
npm run dev        # http://localhost:3300, uses local env files (never committed)
npm run typecheck && npm run lint && npm test && npm run build
CHROME_PATH=/opt/google/chrome/chrome npm run test:e2e   # defaults to the DEV URL; E2E_BASE_URL to override, never PROD
```
