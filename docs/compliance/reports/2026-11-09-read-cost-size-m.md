# 2026-11-09 — Firestore read cost (size M)

Change size **M**. Money totals and the live queue stay the same. The read path changes.

00-core: browser still has no Firestore SDK. Tenant stays the verified owner or the chair-link token. No secrets. Docs updated with the code (`docs/hybrid-read-model.md`, `docs/firestore_schema.md`, `docs/api-reference.md`).

Plan / design: repeated polls were the cost. To Claim stores the unclaimed set and merges changes. Live polls send `queueRev` and skip booking reads when it matches. Quiet tabs wait 30 s. Barber links read the open queue and today's cuts.

Build: `src/lib/remit-snap.ts`, `src/lib/server/remit-snap.ts`, `src/lib/server/remit.ts`, `src/lib/server/shops.ts`, `src/lib/cloud.ts`, sales-rows and barber sales queries. Index added in `firestore.indexes.json`. Not deployed. Not run against production. The snap is built on the first To Claim read. There is no backfill script.

Test: unit tests for the snap and the poll backoff. API tests for an old unclaimed day plus an edited amount, and for the barber window. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Release / operate: **N/A for this PR.** Do not merge to `dev` or `main` and do not deploy until reviewed. Deploy the new Firestore indexes and wait until they are enabled, then deploy the app to DEV before PROD.
