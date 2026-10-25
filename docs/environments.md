# Environments

One Firebase / GCP project, **`mybarberph`** (region `asia-southeast1`), two App Hosting backends and two named Firestore databases.

| | DEV | PROD |
| :--- | :--- | :--- |
| App Hosting backend | `barbers-ph-dev` | `barbers-ph` |
| URL | https://barbers-ph-dev--mybarberph.asia-southeast1.hosted.app | https://barbers-ph--mybarberph.asia-southeast1.hosted.app, https://barbersph.web.app (Hosting site `barbersph` rewrites to Cloud Run `barbers-ph`) |
| Env overlay | `apphosting.dev.yaml` | `apphosting.prod.yaml` |
| Firestore DB | `barbersdb-dev` | `barbersdb` |
| Git branch | `dev` | `main` |
| Storage bucket | `mybarberph-shop-photos` (shared; objects under `shops/{shopId}/`) | same |
| `BARBERS_ENV` | `dev` | `prod` |
| Crawling | `robots.txt` disallows all | allows `/`, disallows `/api/`; pages `noindex` |
| Auth test numbers | `NEXT_PUBLIC_AUTH_TEST_MODE=1` | off |
| Companion (AI) | `COMPANION_ENABLED=1` | off |
| Plan limits | `PLAN_LIMITS_ENABLED=0` | `0` |
| Brevo notify | `BREVO_API_KEY` secret (**the same key as PROD**) | `BREVO_API_KEY` secret |

### Database selection (no default)

Each overlay sets its database explicitly: `apphosting.dev.yaml` → `FIRESTORE_DATABASE_ID=barbersdb-dev`, `apphosting.prod.yaml` → `barbersdb` (plus the `NEXT_PUBLIC_` copy). The base `apphosting.yaml` sets none. The server (`resolveDatabaseId`, `src/lib/firebase/admin.ts`) **fails with a clear error** on its first Firestore call when:

- no database is set (`FIRESTORE_DATABASE_ID is not set …; there is no default`); there is no silent fallback to PROD any more;
- the id is not `barbersdb-dev` or `barbersdb`;
- `BARBERS_ENV` and the id don't match (`dev` must use `barbersdb-dev`, `prod` must use `barbersdb`).

The build doesn't touch Firestore, so it still passes; a misconfigured backend fails on its first API call instead of writing to the wrong database. This relies on each backend's App Hosting environment name selecting its overlay (`dev` → `apphosting.dev.yaml`, `prod` → `apphosting.prod.yaml`); check that in the console when changing a backend.

### Accepted decisions (Jimboy, 2026-10-19)

- **Brevo key shared by DEV and PROD.** Accepted. DEV can send real SMS/email, so DEV tests use test numbers and Jimboy's own contacts only.
- **No rate limiting or App Check.** Accepted exception (see [backend-documentation](backend-documentation.md#abuse-controls)).
- **No customer data retention/deletion job.** Accepted decision; customer bookings are kept until the owner deletes them.
- **Barber links never expire.** The owner confirms each link every 6 months as a nudge (see [auth-flow](auth-flow.md#barbers--chair-links-no-account)).

Shared values (Firebase web config, storage bucket, map style) are in `apphosting.yaml`. Every variable name and purpose is listed in [`env.example`](../env.example).

**Not in the committed config:** `RIVER_MOBILE_API_KEY`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` are commented out in `apphosting.yaml`. Without them the partner API answers `503 not_configured` and checkout is unavailable. Whether they are set in the console for either backend is not verifiable from the repo.

## Branches → environments

| Branch | Environment | Backend |
| :--- | :--- | :--- |
| `dev` | DEV | `barbers-ph-dev` |
| `main` | PROD | `barbers-ph` |

`dev` was created from `main` on 2026-10-19. Work lands on `main`, and `dev` is fast-forwarded to the same commit for DEV (`git push origin main:dev`); `dev` never carries commits that `main` doesn't have. Releases are done from a clean local tree with the Firebase CLI (below). **No automatic rollout configuration was changed**: whether either backend also has GitHub rollouts turned on is set in the Firebase console, not in this repo. See the [release runbook](runbooks/release-smoke-rollback.md).

## Deploy

```bash
export PATH=$HOME/.local/node22/bin:$PATH
# DEV (from a clean tree; retry on HTTP 409 "operation in progress")
firebase deploy --only apphosting:barbers-ph-dev --project mybarberph
# PROD — only with Jimboy's explicit approval
firebase deploy --only apphosting:barbers-ph --project mybarberph
```

`firebase.json` `apphosting.ignore` keeps `.secret*`, `.env*`, logs, screenshots and vendor tooling out of the upload.

### Private submodules

App Hosting clones this repo and does not fill `vendor/river-apps-ui-kit` or `vendor/river-maps`. `scripts/init-submodules.mjs` runs from `prebuild` and checks out the commits already recorded here. It reads `GITHUB_SUBMODULE_TOKEN` (build only, in `apphosting.yaml`).

Create the secret once: a GitHub fine-grained PAT with **Contents: Read** on `idealchop/river-apps-ui-kit` and `idealchop/river-maps`, then grant both backends:

```bash
firebase apphosting:secrets:set GITHUB_SUBMODULE_TOKEN --project mybarberph
firebase apphosting:secrets:grantaccess GITHUB_SUBMODULE_TOKEN --backend barbers-ph-dev --project mybarberph
firebase apphosting:secrets:grantaccess GITHUB_SUBMODULE_TOKEN --backend barbers-ph --project mybarberph
```

The value stays in Secret Manager. The script never prints it. Local builds already have the submodules, so the script does nothing there.

Firestore/Storage rules: `firebase deploy --only firestore:rules,storage --project mybarberph` deploys the same `firestore.rules` to **both** databases, so it needs approval (it touches PROD).

## Local

```bash
npm ci && git submodule update --init
npm run dev        # http://localhost:3300, uses local env files (never committed)
npm run typecheck && npm run lint && npm test && npm run build
CHROME_PATH=/opt/google/chrome/chrome npm run test:e2e   # defaults to the DEV URL; E2E_BASE_URL to override, never PROD
```
