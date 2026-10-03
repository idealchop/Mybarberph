# Firebase adapter (not implemented yet)

Implement `BarbersRepository` (`../repository.ts`) here against the Barbers.ph Firebase project
(its own project, DB and auth; Firestore paths per the plan §3.3, money in centavos, Asia/Manila day keys):

- reads from `shops/{shopId}/…` collections; writes through the `barbersApi` Cloud Functions;
- Partner features (incoming River Mobile bookings, scan to verify) go through the Partner API endpoints (§4);
- tier gating must also be enforced server-side (`403 PLAN_FEATURE_LOCKED`);
- then set `NEXT_PUBLIC_DATA_SOURCE=firebase` and return the new class from `getRepository()` in `../index.ts`.

No UI code needs to change: pages and components only import from `@/data`.
