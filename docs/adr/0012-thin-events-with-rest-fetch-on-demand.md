# ADR-0012: Service Bus events carry IDs and minimal fields only; full data is fetched via REST on demand

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §7 "Service Bus Event Schema"

## Context

Downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling) will subscribe to ingestion events to decide whether to act on new posts or connector-health changes. Events could either carry the full post body or a minimal reference, and this choice has lasting implications once multiple subsystems depend on the event schema.

## Decision

Keep events deliberately thin. `SocialPostIngestedEvent` carries `tenantId`, `postId`, `platformId`, `watchlistId`, `sentiment`, `publishedAt`, and `occurredAt` — not the post's text, engagement metrics, or raw payload. `ConnectorHealthChangedEvent` similarly carries only status transition fields. Subscribers fetch full post data via the REST API (`GET /posts/:id`) on demand.

## Consequences

**Positive**
- Avoids two systems holding potentially-stale duplicate copies of post data: the REST API (backed by Postgres) is the single source of truth for full post content, and events never risk going stale relative to it after an enrichment update or correction.
- Small, stable event payloads are cheap to publish at ingestion volume and are less likely to need a breaking schema change as new fields get added to `SocialPost` — new post fields don't require touching the event contract.
- `sentiment` being included directly in the thin event lets a subscriber like Brand Reputation & Alerts make a cheap "does this need attention" decision without a REST round-trip for every single event, while still treating the API as authoritative for anything beyond that first triage.

**Negative**
- Every subscriber that needs more than the thin fields must make a follow-up REST call per relevant event, adding latency and REST API load proportional to how many events subscribers act on — at high ingestion volume this could become a meaningful load pattern the core API needs to handle.
- Subscribers cannot fully reconstruct post content from the event stream alone (e.g., for replay/backfill scenarios); they depend on the REST API being available and the post not having been deleted since the event fired.

## Alternatives Considered

- **Full post body in the event payload** — subscribers get everything in one message with no follow-up call, but risks staleness the moment enrichment is corrected or reprocessed after the event fired, and grows event size/cost with `rawPayload` and enrichment data that most subscribers won't need for every event.
- **Event carries a diff/change-only payload** — avoids full duplication while giving more than IDs, but adds versioning complexity (what changed since what baseline) that isn't justified when the REST API can already serve the current full state on demand.
