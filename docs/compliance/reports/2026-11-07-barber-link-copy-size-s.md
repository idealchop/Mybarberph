# Size S — barber link copy (2026-11-07)

Change size: **S**. Share to barber copies the existing URL only and confirms in the app. No new route, no schema change, no token rotation.

| Phase | Status | Why |
| :--- | :--- | :--- |
| 00 Core | PASS | Same token, same barber. No browser Firestore writes. Localhost fixture is ignored on production hosts. |
| 01 Plan | N/A | Approved mockup. |
| 02 Design | PASS | Two-state sheet approved 2026-11-07. |
| 03 Build | PASS | `ShareBarberLink`, `BarberLinkCopySheet`, `writeBarberLinkUrl`. |
| 04 Test | PASS | Unit tests plus local browser tests. Not a physical iPhone. |
| 05 Release | PASS | Version 1.0.47. Source release to `dev` and `main` is the approved publish. |
| 06 Operate | N/A | Live deploy is run from the owner's Firebase login, not from this environment. |
