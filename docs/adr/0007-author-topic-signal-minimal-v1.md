# ADR-0007: `AuthorTopicSignal` ships with raw signals only, no computed expertise score

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §4.5 "AuthorTopicSignal (materialized view, periodic refresh)"

## Context

The system needs to support an "expert finder" query — find an author knowledgeable about topic X — exposed via `GET /topics/:topic/authors?sortBy=activeMonths|mentionCount` (§6). There are many plausible ways to rank expertise (recency-weighted, engagement-weighted, decayed, ML-scored), and this is the first version of this subsystem.

## Decision

Model `AuthorTopicSignal` as a periodically refreshed materialized view holding only raw signals: `mentionCount`, `firstMentionAt`/`lastMentionAt`, `activeMonthsCount`, `avgEngagement`, and `sentimentBreakdown`. No computed expertise score is stored. The API exposes `sortBy=activeMonths|mentionCount` so ranking logic stays with the API consumer rather than being baked into the data model.

## Consequences

**Positive**
- Downstream consumers (including future subsystems like Social Selling, which will likely care most about expertise ranking) can apply their own weighting without the core needing to anticipate every ranking strategy up front.
- A raw-signal materialized view is straightforward to refresh periodically and to extend later (e.g., adding a computed score column) without a breaking schema change to `AuthorTopicSignal` itself — new fields are additive.
- Avoids prematurely committing to a scoring formula that would be expensive to change once downstream systems depend on its output ranking.

**Negative**
- API consumers that just want "the best expert" must implement their own composite ranking from `mentionCount`/`activeMonthsCount`/`avgEngagement`/`sentimentBreakdown` rather than calling a single sorted endpoint — more work pushed to every consumer, including the admin UI and future subsystems.
- Because it's a periodically refreshed materialized view rather than a live query, `AuthorTopicSignal` is eventually consistent with the underlying `SocialPost`/`enrichment` data; the refresh cadence isn't specified here and needs to be decided during implementation.

## Alternatives Considered

- **Compute and store an expertise score now** — gives consumers a single sortable field immediately, but bakes an unvalidated scoring heuristic into the data model at v1, which is explicitly what §9 rules out ("Sophisticated expertise scoring beyond raw `AuthorTopicSignal` fields" is out of scope).
- **Live aggregation query instead of a materialized view** — always fresh, but recomputing `activeMonthsCount`/`avgEngagement`/`sentimentBreakdown` per topic per author on every request against a "high-volume and unbounded" post table (§6) is unlikely to meet query latency needs without the same aggregation work a materialized view already does.
