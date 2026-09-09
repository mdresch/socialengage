---
name: platform-operations-dashboard
description: Platform Operations Telemetry UI, quota burn-rate forecasting widget, and guided connector remediation drawer in social-listening-admin (ADR-0089, ADR-0128, Story 10.7, Story 16.4).
---

# Platform Operations Dashboard UI (ADR-0089, ADR-0128)

## Purpose
Provides operators with an operational command surface rendered at `/admin/operations` with live system telemetry, tenant quota burn-rate forecasting, and interactive guided playbooks to remediate stalled or failing connectors.

## Components & Architecture
1. **`PlatformOperationsDashboard.tsx` (`/admin/operations`):**
   - Renders live throughput (posts/sec), ingestion latency (sec), 24h error rates, and estimated 30d AI costs.
   - Integrates `QuotaBurnRateForecast` and `ConnectorRemediationDrawer`.
   - Polls `/api/admin/platform-dashboard` every 30s.
2. **`QuotaBurnRateForecast.tsx` (Story 16.4, ADR-0128):**
   - Displays risk summary counters and tabular projections for all tenants.
   - Visualizes trailing 7-day velocity (tokens/day), days remaining, projected exhaustion date, and risk badges (`healthy`, `warning_30d`, `critical_7d`).
3. **`ConnectorRemediationDrawer.tsx` (Story 16.4, ADR-0128):**
   - Slide-out drawer displaying connector telemetry and guided playbooks:
     - Immediate retry (`retry_now`)
     - Override backoff window (`override_backoff` with minutes)
     - Clear error state (`clear_error_state`)
     - Flag for credential reprompt (`reprompt_credentials`)
   - Provides live submission state, error handling, and triggers dashboard refresh on success.
4. **API Proxy Routes:**
   - `GET /api/admin/platform-dashboard`
   - `POST /api/admin/connectors/[id]/remediate` and `POST /api/admin/connectors/remediate`
