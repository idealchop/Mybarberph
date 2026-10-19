# Release, smoke and rollback

## Release (DEV always first)

1. Clean tree: `git status --short` shows nothing but the `vendor/river-apps-ui-kit` submodule marker. No `.secret*` / `.env*` staged.
2. Health: `npm run typecheck && npm run lint && npm test && npm run build` (Node 22).
3. Push `main`.
4. DEV: `firebase deploy --only apphosting:barbers-ph-dev --project mybarberph`. On HTTP 409 (another rollout running) wait ~60 s and run it again.
5. Smoke DEV (below). Record URL, time (Asia/Manila), PASS/FAIL, who.
6. PROD only after Jimboy says so: `firebase deploy --only apphosting:barbers-ph --project mybarberph`, then smoke PROD.

## Smoke (after every deploy)

| Check | How | Pass |
| :--- | :--- | :--- |
| Health | open `/home`, `/book`, `/privacy` | 200, no error screen |
| Automated | `CHROME_PATH=/opt/google/chrome/chrome npm run test:e2e` (DEV only) | all PASS |
| Auth | sign in with a test persona (Firebase test phone on DEV) | lands on Home signed in |
| HP | create a walk-in, move it to Done, see it under "Done today" and in Sales | shows in both |
| Mutation + GET | edit a service price in Settings, reload | new price shown |
| No secrets | view-source / network tab of `/home` | no keys besides the public Firebase web config |
| Console | browser console on Home and Queue | no new red errors |

On PROD, do the HP and Mutation checks with Jimboy's own test shop only, never a customer's shop.

## Rollback

- **DEV**: fix forward and redeploy.
- **PROD**: Firebase console → App Hosting → `barbers-ph` → Rollouts → roll back to the previous rollout. Or check out the previous good commit in a clean tree and run the PROD deploy command from it (with Jimboy's OK). Then smoke again.
- Never delete or rewrite PROD data to undo a release without Jimboy's explicit OK.
- Never force-push `main`.
- Rules (Firestore/Storage): redeploy the previous `firestore.rules` / `storage.rules` from git; they go to both databases.
- Kill switches: `COMPANION_ENABLED` (AI), `PLAN_LIMITS_ENABLED` (plan limits). Change in `apphosting.<env>.yaml` and redeploy.
