## Summary

<!-- Why this change exists (1–3 bullets). -->

-

**Change size:** S / M / L  
<!-- See river-ai-rules/00-core/change-sizing-and-proportionality.md — integrity laws always apply. -->

## SDLC gates (River AI Rules)

Link or paste phase **summary reports** from `river-ai-rules/reports/`. Mark N/A only with **size + reason** (Size S often uses one note for unused phases).

| Phase | Status | Report / notes |
| :--- | :--- | :--- |
| 00 Core | PASS / N/A | |
| 01 Plan | PASS / N/A | |
| 02 Design | PASS / N/A | |
| 03 Build | PASS / N/A | |
| 04 Test (Create→Apply→**Execute**) | PASS / N/A | execution log: |
| 05 Release | PASS / N/A / later | |
| 06 Operate | PASS / N/A | |

Catalog: `river-ai-rules/README.md` · Justification: `river-ai-rules/JUSTIFICATION.md`

## Test plan

- [ ] HP / NEG / ODD / NF cases applied and **executed** (not design-only)
- [ ] Dual GET verified for new mutations
- [ ] Authz / tenant negatives when authz changed
- [ ] Lint + `tsc` (+ build if shipping)
- [ ] SEO/AEO/GEO / a11y / perf / privacy considered for touched surfaces
- [ ] Feature flag / kill switch if high-risk Prod change

## Risk & rollback

- Risk: …
- Rollback / kill switch: none / …

## Checklist

- [ ] No secrets committed
- [ ] Docs updated if schema / API / auth / env changed
- [ ] FE/BE contract respected (no FE business writes)
