---
name: ai-insights-digest
description: AI-generated executive summaries, sentiment breakdowns, theme analysis, and strategic recommendations (ADR-0094, Story 10.14).
---

# AI Insights Digest (ADR-0094)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.14.ai-insights-digest.contract.test.ts` — Story 10.14 contract test.

## Purpose
Synthesizes high-level brand intelligence, sentiment trends, top emerging themes, and actionable strategic recommendations over daily and weekly periods.

## Invariants
1. **Periodic Aggregation:** Generates executive digests over 1-day (daily) or 7-day (weekly) windows.
2. **Sentiment & Theme Analysis:** Breaks down positive/neutral/negative ratios, theme clustering, and sentiment trajectory.
3. **Actionable Recommendations:** Outputs structured strategic suggestions tailored to audience perception.

## Endpoints
- `GET /v1/analytics/digest?period=daily|weekly`: Fetch AI executive intelligence digest.

**Documentation Steward correction, 2026-09-10.** The `ADR-0094` citation above is wrong: real `ADR-0094` (`docs/adr/0094-compliance-audit-pack.md`) is "Compliance audit pack," unrelated to this digest feature. No real governing ADR exists for this component in the current numbering — see `webhook-notifications/SKILL.md`'s matching 2026-09-10 correction for the full account. Not fixed by inventing a correct ADR number here; flagged for Menno.
