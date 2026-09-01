---
name: youtube-data-connector
description: YouTube Data API v3 Ingestion Connector, channel subscriptions, and quota monitoring (ADR-0093, Story 10.13).
---

# YouTube Data API v3 Ingestion Connector (ADR-0093)

## Purpose
Ingests YouTube video comments, community posts, and video descriptions matching tenant watchlists with quota monitoring (10,000 units/day limit).

## Invariants
1. **Quota Throttling:** Tracks daily quota usage per tenant in `youtube_channel_subscriptions` to prevent API rate limiting.
2. **Channel Linking:** Channels are subscribed with `POST /v1/connectors/youtube/connect`.
3. **Status Monitoring:** `GET /v1/connectors/youtube/status` returns active state, channel count, and quota consumption.

## Endpoints
- `GET /v1/connectors/youtube/status`: Get YouTube connector health and quota usage
- `POST /v1/connectors/youtube/connect`: Subscribe and link YouTube channel
