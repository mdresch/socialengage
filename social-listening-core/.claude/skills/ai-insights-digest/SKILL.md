---
name: ai-insights-digest
description: AI-generated executive summaries, sentiment breakdowns, theme analysis, and strategic recommendations. Built by commit `fdb9bb8` (2026-08-27) under contract `story-10.14.ai-insights-digest`; the "ADR-0094, Story 10.14" citation this file previously carried was wrong — ADR-0094 is Compliance audit pack (see `docs/adr/0094-compliance-audit-pack.md`), and `docs/user-stories/epic-10-adr-0086-to-0094.md`'s own real Story 10.14 is "Trust and rights admin UI," neither of which is this feature.
---

# AI Insights Digest

**Documentation Steward correction, 2026-09-11:** this component's `description` and the "ADR-0094" heading below previously cited ADR-0094/Story 10.14 as its governing decision. Both are wrong: ADR-0094 governs the Compliance audit pack (unrelated), and the real Story 10.14 in `docs/user-stories/epic-10-adr-0086-to-0094.md` is "Trust and rights admin UI" (also unrelated, and — per that file's own 2026-09-11 note — still not built). This component ships with a contract test literally named `story-10.14.ai-insights-digest.contract.test.ts`, but no epic file anywhere documents an "AI insights digest" story under any number; the closest documented, similarly-named feature is Story 11.3/11.4 "Daily digest email" (ADR-0096), which is a different feature (scheduled email vs. on-demand dashboard card). No correct governing ADR/Story number could be confidently identified from the docs tree — flagged for Menno to assign the right one; not decided here.

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.14.ai-insights-digest.contract.test.ts` — the contract test's own filename, kept as-is (renaming a passing contract file is a code change outside this role's scope); its number does not correspond to any real Story 10.14 in `docs/user-stories/`.

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
- **`analytics-dashboard` admin SKILL.md** — the `AiInsightsDigestCard` component (built alongside this backend in the same `fdb9bb8` commit, story number unresolved per the correction above) consuming `GET /v1/analytics/digest` via the BFF proxy route `/api/analytics/digest`.
- **`precomputed-analytics-views` skill** — the digest endpoint may leverage precomputed daily rollup tables for fast sentiment/volume summaries rather than scanning raw `social_posts` for every request.
