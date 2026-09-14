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

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.6.platform-metrics.contract.test.ts` — Story 10.6 contract test.

## Relations to other components

- **`platform_metrics` table** — stores rolling ingestion throughput, error rates, and token consumption snapshots populated by the metrics aggregation worker; the endpoint reads from here with a 60-second cache TTL.
- **`platform_admin_audit_log` table / `platform-admin-audit-log` skill** — every remediation action (`POST /v1/admin/connectors/:id/remediate`) records one audit row for accountability and tamper evidence.
- **`connector_activations` / `connector_health` tables** — health table drives per-platform status entries in the dashboard response; remediation actions may update `connector_activations` (e.g., clearing error state, retrying backoff).
- **`getAdminPool()` (admin connection pool)** — dashboard aggregation queries run under the admin pool to access system-wide metrics across all tenants without RLS tenant-scoping.
- **`platform-operations-dashboard` admin SKILL.md** — the `PlatformOperationsDashboard` component (Story 10.7) rendering the frontend dashboard, quota burn-rate card, and guided remediation drawer.
- **`azure-openai-connector` skill** — token consumption telemetry surfaced by this dashboard comes from Azure OpenAI API usage tracked during enrichment; the dashboard makes that cost visible at the platform level. **Documentation Steward correction, 2026-09-14: not backed by a real call site.** `azureOpenAiConnector.ts` never writes to `platform_metrics`, and no code anywhere populates the `estimated_total_cost` metric this dashboard prefers (`platformMetricsStore.ts`'s `costFromMetrics` — only exercised in the Story 13.8/ADR-0114 contract, `azureMetricsClient.ts` has no cost/OpenAI-derived metric either). In real production the dashboard always falls back to `estimatedCostFromTokens`, a synthetic heuristic (`posts30d * 850` tokens, flat $0.0015/1K), not measured Azure OpenAI usage. Flagged for Menno (component: `platform-operations-dashboard`; relationship: Azure OpenAI cost telemetry; stories: 10.7/13.8) — not fixed here.
