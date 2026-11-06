# Size S — barber link open failure (2026-11-06)

Change size: **S**. One client load path, the chair-list filter that feeds the next save, the approved recovery screens, and regression tests. No new route and no schema migration. Version 1.0.46.

| Phase | Status | Why |
| :--- | :--- | :--- |
| 00 Core | PASS | No browser Firestore writes. Tenant stays the token's own shop and barber. A 404 does not fall back to another barber's data or to a saved copy. No secrets. |
| 01 Plan | N/A | The failing URL is not available. Scope is the resolution path in current `dev` (`b43e219`), not a new feature. |
| 02 Design | PASS | Approved mockup built: opening, offline with nothing saved, couldn't open, turned off. A saved copy stays the working home plus the offline banner. |
| 03 Build | PASS | Logic only: don't treat another snapshot or an in-flight load as a dead link; don't drop a chair row that still has an id; a confirmed 404 clears that phone's copy; a timeout / offline / 5xx keeps it. |
| 04 Test | PASS | In-memory unit + API tests listed in `docs/testing/test-plan.md` (2026-11-06). No prod data, no live token. |
| 05 Release | PASS | Version 1.0.46 (`package.json`, reported by `/api/version`). Source release to `dev` and `main` is the approved publish. |
| 06 Operate | N/A | No deploy, no live data change, no alert change. |

The reported Android screen was not reproduced. The exact URL was not supplied. Version 1.0.46 is the approved source release of the recovery screens and the earlier link fixes.

## 2026-11-06 UI follow-up

The approved mockup is implemented. Try again and Check again call `retryBarberCloud` for the token already on screen. A saved copy is not replaced by a placeholder.
