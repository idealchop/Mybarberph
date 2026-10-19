# AGENTS.md — Barbers.ph

Instructions for AI agents and humans working in this repo.

1. Read [docs/README.md](./docs/README.md) first. App docs are the source of truth, then the rulebook.
2. Rulebook: **River AI Rules v1.0.1** (<https://github.com/idealchop/river-ai-rules>). Cursor loads it via [.cursor/rules/river-ai-rules.mdc](./.cursor/rules/river-ai-rules.mdc) and the local pointer [.cursor/rules/barbers-ph-documentation.mdc](./.cursor/rules/barbers-ph-documentation.mdc). Current status: [docs/compliance/river-ai-rules-1.0.1.md](./docs/compliance/river-ai-rules-1.0.1.md).
3. Declare change size **S / M / L** and follow the phases in scope (00 Core → 06 Operate). PRs use [.github/PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md).
4. Laws that never scale down: no business Firestore writes from the browser, every mutation has a paired GET, tenant from the verified token (never the request body), no secrets in git, DEV before PROD, docs updated in the same change.
5. Before "done": `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (Node 22). UI changes: also `npm run test:e2e` against DEV (read-only) and check 320px + 1280px.
6. Deploy: DEV only — `firebase deploy --only apphosting:barbers-ph-dev --project mybarberph` from a clean tree; retry on HTTP 409. PROD and Firestore/Storage rules need Jimboy's explicit OK (rules apply to the prod database too).
7. Never commit or deploy `.secret*` or `.env*`; never stage `vendor/river-apps-ui-kit`; never print tokens.
