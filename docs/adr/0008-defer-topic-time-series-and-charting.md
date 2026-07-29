# ADR-0008: Defer `TopicDailyCount` aggregation and all charting to a future subsystem

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §4.6 "Deferred" and §9 "Explicitly Out of Scope"

## Context

Topic-volume-over-time is a natural feature (e.g., "mentions of X per day") built on data this subsystem already captures — `enrichment.entities`/`keyPhrases` and `publishedAt` on `SocialPost`. But this spec's scope is explicitly the ingestion/insights *data* subsystem, not dashboards; charting UI and other consumer-facing analytics are called out as belonging to later subsystems (§1, §9).

## Decision

Do not build a `TopicDailyCount` aggregation table, endpoint, or any charting UI in this subsystem. Rely on the fact that the underlying data (`enrichment.entities`/`keyPhrases`, `publishedAt`) is already captured on `SocialPost` and is sufficient for a future insights/dashboard subsystem to build this aggregation independently.

## Consequences

**Positive**
- Keeps this subsystem's scope aligned with its stated purpose (§1): ingestion, normalization, enrichment, storage, and exposing data via events/API — not visualization.
- Avoids committing to a time-series aggregation grain (daily? hourly? per-tenant-timezone?) before a consuming dashboard subsystem's actual requirements are known.
- No wasted work: because `entities`/`keyPhrases`/`publishedAt` are already on `SocialPost`, deferring this doesn't require any compensating design now — the future subsystem can compute `TopicDailyCount` directly from existing data.

**Negative**
- Any consumer wanting topic-volume-over-time today must aggregate `GET /posts` results client-side (paginated, per §6), which is materially more expensive than querying a pre-aggregated table — acceptable for now since no such consumer exists yet in scope.
- The future insights subsystem will need read access to raw post-level enrichment data (via API or a data-layer contract not yet defined) to build `TopicDailyCount`, which is a dependency this ADR doesn't resolve.

## Alternatives Considered

- **Build `TopicDailyCount` now, even without a consumer** — would save the future subsystem some work, but speculatively designs an aggregation shape before the actual dashboard requirements exist, risking a table that has to be redesigned anyway.
