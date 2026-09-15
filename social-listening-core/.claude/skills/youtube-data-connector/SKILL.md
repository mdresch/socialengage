---
name: youtube-data-connector
description: YouTube Data API v3 Ingestion Connector, channel subscriptions, and quota monitoring (ADR-0093, Story 10.13).
---

# YouTube Data API v3 Ingestion Connector (ADR-0093)

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
