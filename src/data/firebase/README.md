# Firebase adapter

Implements `BarbersRepository` against the **single** Barbers.ph Firebase project
[`mybarberph`](https://console.firebase.google.com/project/mybarberph/overview).

| | |
| --- | --- |
| Project | `mybarberph` (one GCP/Firebase project — not aquaflow / riverdb) |
| Auth | Shared email/password (Google optional once an OAuth client is added) |
| Dev database | `barbersdb-dev` |
| Prod database | `barbersdb` |
| App Hosting | `barbers-ph-dev` → dev DB · `barbers-ph` → prod DB |

## How it is wired

- **Server pages** call `getServerRepository()` → Admin SDK, scoped to the shop from the session cookie. Membership is checked (`shops/{shopId}/members/{uid}`).
- **Client mutations** call `getRepository()` → `POST /api/repo` with the same session. The API re-checks membership before every method.
- **Rules** (`firestore.rules`): members may read shop data; all writes are denied to clients (Admin SDK / API only). This closes the River Kit tenancy hole.
- Set `NEXT_PUBLIC_DATA_SOURCE=firebase` (and the matching `FIRESTORE_DATABASE_ID`) to use this adapter. Default remains `mock` for demos without credentials.

## Seed

```bash
npm run seed   # writes Kanto Kings into barbersdb-dev; demo login owner@kantokings.ph
```
