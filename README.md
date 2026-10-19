# Barbers.ph (Mybarberph)

The **Barbers.ph** barbershop app from River Apps. Shop owners run the queue, walk-ins, chairs, sales and cash collection. Barbers work from a chair link (no account), and customers book or join the queue from the shop's QR code. River Mobile books through a partner API.

One Next.js 16 app is both the web UI and the API (`src/app/api`). Data lives in Firestore and Storage on Firebase project `mybarberph`, through the server only. The browser uses Firebase Auth for sign-in and nothing else.

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Firebase Auth (web) + Firebase Admin SDK (server), npm, **Node 22**.
- **UI:** the private **River Apps UI Kit** ([`idealchop/river-apps-ui-kit`](https://github.com/idealchop/river-apps-ui-kit), git submodule in `vendor/`), used as-is.
- **Wording:** a station is always a **Chair**, never a "Bay".
- **Rules:** this repo follows [River AI Rules](https://github.com/idealchop/river-ai-rules) 1.0.1. See [AGENTS.md](./AGENTS.md) and [docs/compliance/river-ai-rules-1.0.1.md](./docs/compliance/river-ai-rules-1.0.1.md).

## Setup

Needs Node 22, npm 10, and read access to the private kit repo.

```bash
git clone --recurse-submodules https://github.com/idealchop/Mybarberph.git
cd Mybarberph
git submodule update --init --recursive   # if cloned without submodules
npm install
npm run dev                                # http://localhost:3300
```

Local env: copy the names from [`env.example`](./env.example) into your own untracked local env file. Never commit env or secret files.

| Script | What it does |
| --- | --- |
| `npm run dev` | builds the kit tokens, then `next dev` on port 3300 |
| `npm run build` | kit tokens, then `next build` |
| `npm start` | serves the build on port 3300 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: unit + API contract tests |
| `npm run test:e2e` | Playwright against DEV (set `CHROME_PATH`; `E2E_BASE_URL` to override, never PROD) |
| `npm run screenshots` | screenshots helper (`scripts/screenshots.py`) |

## Docs

Start at **[docs/README.md](./docs/README.md)**: architecture, Firestore schema, auth, roles, environments, API reference, read model, testing, runbooks and the River Mobile partner API.

## Deploy

DEV: `firebase deploy --only apphosting:barbers-ph-dev --project mybarberph`. PROD (`barbers-ph`) only with Jimboy's OK. See [docs/environments.md](./docs/environments.md) and [docs/runbooks/release-smoke-rollback.md](./docs/runbooks/release-smoke-rollback.md).
