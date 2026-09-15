---
name: youtube-data-connector
description: YouTube Data API v3 Ingestion Connector, channel subscriptions, and quota monitoring (ADR-0093, Story 10.13).
---

# YouTube Data API v3 Ingestion Connector (ADR-0093)

**Documentation Steward note, 2026-09-15.** This skill's own ADR citation (ADR-0093) is almost certainly wrong — ADR-0093 is "DSR self-service portal" (`docs/adr/0093-dsr-self-service-portal.md`), unrelated to YouTube ingestion. No dedicated YouTube-ingestion ADR appears to exist anywhere in `docs/adr/` at all (grepped for "youtube" across every ADR file — the only real hits are incidental mentions in ADR-0042's footnote and ADR-0118's publishing roadmap, neither of which authorizes this connector's own design). See `docs/user-stories/epic-10-adr-0086-to-0094.md`'s own Story 10.11 dated note for the full account. Not corrected here — every other real connector in this project (Wikipedia, Facebook, Instagram, LinkedIn, Brave, Bing) went through this project's own "no story until ADR acceptance" discipline; this connector appears to be the first exception, and whether it needs a real ADR drafted after the fact is a decision for Menno, not resolved here.

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.13.youtube-connector.contract.test.ts` — Story 10.13 contract test.

## Purpose
Ingests YouTube video comments, community posts, and video descriptions matching tenant watchlists with quota monitoring (10,000 units/day limit).

## Invariants
1. **Quota Throttling:** Tracks daily quota usage per tenant in `youtube_channel_subscriptions` to prevent API rate limiting.
2. **Channel Linking:** Channels are subscribed with `POST /v1/connectors/youtube/connect`.
3. **Status Monitoring:** `GET /v1/connectors/youtube/status` returns active state, channel count, and quota consumption.

## Endpoints
- `GET /v1/connectors/youtube/status`: Get YouTube connector health and quota usage
- `POST /v1/connectors/youtube/connect`: Subscribe and link YouTube channel

## Relations to other components

- **`youtube_channel_subscriptions` table** — stores linked channel IDs, daily quota tracking, and last-poll timestamps per `tenant_id`; gated by RLS.
- **`social_posts` table** — ingested YouTube video comments and community posts are written here as standard posts with `platform = 'youtube'`.
- **`connector_activations` table / `connector-activation` skill** — YouTube ingestion only runs when the tenant has an active connector activation; the `shouldAttemptIngestion()` gate checks this before poll scheduling.
- **`bootstrapConnectors.ts`** — YouTube connector registers itself in the connector registry at server startup so the live-ingestion polling scheduler can dispatch `poll()` calls.
- **`provider-connector-framework` skill** — YouTube implements the `SocialConnector` interface; all contracts and registration follow the same framework as Facebook, Instagram, LinkedIn, and other ingestion connectors.
- **`connector-status-view` admin SKILL.md** — YouTube connector health is surfaced in the tenant connector status screen alongside other active connectors.
