---
name: platform-operations-dashboard
description: Platform metrics aggregation, Azure Monitor/counter integration, and GET /v1/admin/platform-dashboard endpoint (ADR-0089, Story 10.6).
---

# Platform Operations Dashboard (ADR-0089)

## Purpose
Provides platform-level and tenant administrators with real-time visibility into ingestion throughput, connector health, error rates, token consumption, and cost estimates.

## Invariants
1. **Metrics Rollup:** Aggregates ingestion rates (posts/sec), 24h error rates, Azure OpenAI token consumption, and connector statuses.
2. **In-Memory Cache:** `GET /v1/admin/platform-dashboard` is cached with a 60-second TTL to avoid scanning system tables on every poll.
3. **Connector Health Table:** Exposes per-platform status (healthy, degraded, error, disconnected), error counts, and last success timestamps.

## Endpoints
- `GET /v1/admin/platform-dashboard`: Returns platform summary tiles, connector health, and 24h time-series.
