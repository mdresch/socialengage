---
name: ai-insights-digest
description: AI-generated executive summaries, sentiment breakdowns, theme analysis, and strategic recommendations (ADR-0094, Story 10.14).
---

# AI Insights Digest (ADR-0094)

## Purpose
Synthesizes high-level brand intelligence, sentiment trends, top emerging themes, and actionable strategic recommendations over daily and weekly periods.

## Invariants
1. **Periodic Aggregation:** Generates executive digests over 1-day (daily) or 7-day (weekly) windows.
2. **Sentiment & Theme Analysis:** Breaks down positive/neutral/negative ratios, theme clustering, and sentiment trajectory.
3. **Actionable Recommendations:** Outputs structured strategic suggestions tailored to audience perception.

## Endpoints
- `GET /v1/analytics/digest?period=daily|weekly`: Fetch AI executive intelligence digest.
