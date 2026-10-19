# Release, smoke and rollback

## Branches

`dev` → DEV (`barbers-ph-dev`), `main` → PROD (`barbers-ph`). `dev` was created from `main` on 2026-10-19. Commit to `main`, then fast-forward `dev` to the same commit; `dev` never has its own commits. No automatic rollout setting was changed in the repo or console.

```bash
git push origin main
git push origin main:dev        # fast-forward only; never force
git rev-parse origin/main origin/dev   # same commit
```

## Release (DEV always first)

1. Clean tree: `git status --short` shows nothing but the `vendor/river-apps-ui-kit` submodule marker. No `.secret*` / `.env*` staged.
2. Health: `npm run typecheck && npm run lint && npm test && npm run build` (Node 22).
3. Push `main`, then fast-forward `dev` to it (above).
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
| Money | complete one cut paid cash and one GCash, one with "+ Add tip" | Collected shows the Cash/GCash split and "incl. ₱X tips"; Sales doesn't include the tip |
| Barber link | open a barber link; try to change the amount | Amount is read-only "Menu price"; only that barber's visits show |
| Mutation + GET | edit a service price in Settings, reload | new price shown |
| No secrets | view-source / network tab of `/home` | no keys besides the public Firebase web config |
| Console | browser console on Home and Queue | no new red errors |

On PROD, do the HP and Mutation checks with Jimboy's own test shop only, never a customer's shop.

## Rollback

- **DEV**: fix forward and redeploy.
- **PROD**: Firebase console → App Hosting → `barbers-ph` → Rollouts → roll back to the previous rollout. Or check out the previous good commit in a clean tree and run the PROD deploy command from it (with Jimboy's OK). Then smoke again.
- Never delete or rewrite PROD data to undo a release without Jimboy's explicit OK.
- Never force-push `main`.
- Rules (Firestore/Storage): redeploy the previous `firestore.rules` / `storage.rules` from git (`git show <good>:firestore.rules > firestore.rules`, deploy, then restore); they go to both databases.
- Database guard: if a backend fails with "FIRESTORE_DATABASE_ID is not set…", its overlay wasn't selected. Fix the backend's environment name (`dev`/`prod`) in the console, or set the variable, and roll out again. Never point DEV at `barbersdb`.
- Kill switches: `COMPANION_ENABLED` (AI), `PLAN_LIMITS_ENABLED` (plan limits). Change in `apphosting.<env>.yaml` and redeploy.
