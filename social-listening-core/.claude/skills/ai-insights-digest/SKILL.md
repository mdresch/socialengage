---
name: ai-insights-digest
description: AI-generated executive summaries, sentiment breakdowns, theme analysis, and strategic recommendations (ADR-0094, Story 10.14).
---

# AI Insights Digest (ADR-0094)

**Documentation Steward note, 2026-09-15.** This skill's ADR-0094 citation is shared with the compliance-audit-pack engine (`social-listening-core/.claude/skills/compliance/SKILL.md`, which also correctly cites ADR-0127 for its own Story 16.3 refinement) — ADR-0094 itself is "Compliance audit pack" (`docs/adr/0094-compliance-audit-pack.md`), unrelated to AI-generated digests/summaries. See `docs/user-stories/epic-10-adr-0086-to-0094.md`'s own Story 10.11/10.13 dated notes for the full account. Not corrected here — assigning the real governing ADR (this content looks conceptually closer to ADR-0096's "Daily digest email," Epic 11, but that is not confirmed) is a content/traceability decision for Menno.

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

## Relations to other components

- **`azure-openai-connector` skill** — the digest generator calls Azure OpenAI (gpt-5-mini or equivalent) to synthesize the executive summary, theme analysis, and strategic recommendations from aggregated post/sentiment data.
- **`social_posts` table** — raw post records filtered by `tenant_id` and the requested period window are the source material for sentiment ratios, theme frequency, and volume metrics fed into the generation prompt.
- **`social-post-enrichment` skill** — enrichment data (sentiment labels, aspect annotations) on `social_posts` is what makes the digest's sentiment breakdown meaningful; digest quality degrades gracefully when enrichment is unavailable.
- **`analytics-dashboard` admin SKILL.md** — the `AiInsightsDigestCard` component (Story 10.14 frontend) consuming `GET /v1/analytics/digest` via the BFF proxy route `/api/analytics/digest`.
- **`precomputed-analytics-views` skill** — the digest endpoint may leverage precomputed daily rollup tables for fast sentiment/volume summaries rather than scanning raw `social_posts` for every request.
