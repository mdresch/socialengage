---
name: platform-operations-dashboard
description: Platform metrics aggregation, quota burn-rate forecasting, connector remediation playbooks, and GET /v1/admin/platform-dashboard endpoint (ADR-0089, ADR-0128, Story 10.6, Story 16.4).
---

# Platform Operations Dashboard (ADR-0089, ADR-0128)

## Purpose
Provides platform-level and tenant administrators with real-time visibility into ingestion throughput, connector health, error rates, token consumption, cost estimates, tenant quota burn-rate forecasting, and guided remediation controls for degraded/stalled connectors.

## Invariants
1. **Metrics Rollup:** Aggregates ingestion rates (posts/sec), 24h error rates, Azure OpenAI token consumption, and connector statuses.
2. **In-Memory Cache:** `GET /v1/admin/platform-dashboard` is cached with a 60-second TTL to avoid scanning system tables on every poll.
3. **Connector Health Table:** Exposes per-platform status (healthy, degraded, error, disconnected), error counts, and last success timestamps.
4. **Quota Burn-Rate Forecasting (Story 16.4, ADR-0128):** Computes trailing 7-day token velocity and linear projection against monthly quota, classifying risk into `healthy` (>30d), `warning_30d` (8–30d), and `critical_7d` (≤7d or exhausted).
5. **Guided Connector Remediation (Story 16.4, ADR-0128):** Platform-admin role-gated playbooks (`retry_now`, `override_backoff`, `clear_error_state`, `reprompt_credentials`) with all actions recorded to `platform_admin_audit_log`.

## Endpoints
- `GET /v1/admin/platform-dashboard`: Returns platform summary tiles, connector health, 24h time-series, and `tenantQuotaBurnProjections`.
- `POST /v1/admin/connectors/:id/remediate`: Role-gated remediation endpoint executing operational playbooks with audit logging.
