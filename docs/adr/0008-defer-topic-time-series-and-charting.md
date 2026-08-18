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

---

## Pending supersession note (2026-08-17)

**[ADR-0054](0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) (Proposed, not yet accepted) would narrowly supersede part of this ADR's Decision, if accepted — named here exactly which part, per `docs/adr/README.md`'s own governance-table convention (row 5).** This is not an edit to this ADR's own Decision/Consequences text above, and takes effect only once ADR-0054 is actually accepted.

**What would change:** this ADR's Decision text bundles two things under one sentence — "Do not build a `TopicDailyCount` aggregation table, endpoint, **or any charting UI** in this subsystem." ADR-0054 would supersede only the "any charting UI" clause, narrowly bounded to client-side-computed charting inside `social-listening-admin`, using data `GET /posts` and its `enrichment` fields already return, with zero new backend aggregation.

**What would not change:** the "no `TopicDailyCount` aggregation table, endpoint" clause — ADR-0054 builds no new `social-listening-core` endpoint, stored aggregate, or aggregation grain of any kind. This ADR's own Negative Consequences bullet — *"Any consumer wanting topic-volume-over-time today must aggregate `GET /posts` results client-side... materially more expensive than querying a pre-aggregated table — acceptable for now since no such consumer exists yet in scope"* — is the exact trade-off ADR-0054 now exercises, for the exact consumer (this subsystem's own admin UI) this ADR's own text anticipated without naming.

---

## Supersession update (2026-08-17)

**The pending supersession named directly above is now real: ADR-0054 was accepted by Menno on 2026-08-17** (via a structured approval decision in the orchestrating session — see ADR-0054's own Acceptance note for the exact mechanism). This ADR's Decision text above is **not edited** — per this file's own "don't rewrite history" discipline and `docs/adr/README.md`'s own governance-table convention, the original Decision stands as the historical record, with this dated note confirming which part of it is now superseded in practice.

**Confirmed, exactly as the pending note above anticipated:** this ADR's "no `TopicDailyCount` aggregation table, endpoint" clause remains fully in force, untouched — ADR-0054 added no new `social-listening-core` endpoint, stored aggregate, or aggregation grain. This ADR's "any charting UI in this subsystem" clause is now superseded **in part**, narrowly bounded to exactly ADR-0054's own decided scope: client-side-computed charting inside `social-listening-admin` (`/tenant/analytics`, Epic 8, Stories 8.1–8.3), computed entirely from data `GET /posts`/`enrichment` already return, with zero new backend aggregation. Any charting UI or aggregation beyond that narrow scope — a stored `TopicDailyCount`-shaped table, a dedicated analytics/reporting subsystem, server-side pre-computed rollups — remains exactly as deferred as this ADR originally decided, unaffected by ADR-0054's acceptance.
