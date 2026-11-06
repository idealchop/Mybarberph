# Size S — barber link open failure (2026-11-06)

Change size: **S**. One client load path, the chair-list filter that feeds the next save, docs that contradicted the code, and regression tests. No new route, no schema migration, no publish, no UI redesign.

| Phase | Status | Why |
| :--- | :--- | :--- |
| 00 Core | PASS | No browser Firestore writes. Tenant stays the token's own shop and barber. A 404 does not fall back to another barber's data or to a saved copy. No secrets. |
| 01 Plan | N/A | The failing URL is not available. Scope is the resolution path in current `dev` (`b43e219`), not a new feature. |
| 02 Design | N/A for the app | Recovery screens are a mockup only (`/opt/cursor/artifacts/barber-link-*.png`). The app still uses the existing sentence when nothing is saved. |
| 03 Build | PASS | Logic only: don't treat another snapshot or an in-flight load as a dead link; don't drop a chair row that still has an id; a confirmed 404 clears that phone's copy; a timeout / offline / 5xx keeps it. |
| 04 Test | PASS | In-memory unit + API tests listed in `docs/testing/test-plan.md` (2026-11-06). No prod data, no live token. |
| 05 Release | N/A | Not published. Version stays 1.0.45 until a separate publish plan. |
| 06 Operate | N/A | No deploy, no live data change, no alert change. |

The reported Android screen was not reproduced. The exact URL was not supplied.
