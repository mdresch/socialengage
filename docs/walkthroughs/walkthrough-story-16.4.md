# Walkthrough — Story 16.4: Platform Ops Quota Burn-Rate Forecasting & Guided Connector Remediation

## 1. Summary of Accomplishments
Implemented platform operations quota burn-rate velocity forecasting and guided connector remediation controls across `social-listening-core` and `social-listening-admin` per **ADR-0128**, **BRD-0128**, **FDD-0128**, **TDS-0128**, and **Story 16.4**:

### 1.1 Backend (`social-listening-core`)
- **Quota Velocity & Burn-Rate Calculation Engine (`quotaBurnRatePredictor.ts`):**
  - Implemented `computeBurnProjection()`:
    $$\text{dailyVelocity7d} = \frac{\sum_{i=1}^7 \text{Tokens}_i}{7}, \quad \text{daysRemaining} = \frac{\text{remainingQuota}}{\text{dailyVelocity7d}}$$
  - Classifies status into `healthy` (>30d), `warning_30d` (8–30d), and `critical_7d` (≤7d or exhausted).
  - Implemented `getTenantQuotaBurnProjections()` aggregating real tenant monthly quotas (derived from license seats) and trailing 7d/30d token consumption.
- **Platform Telemetry Dashboard Endpoint (`platformMetricsStore.ts`, `platformDashboardRouter.ts`):**
  - Updated `PlatformDashboardSummary` and `getPlatformDashboardData()` to return `tenantQuotaBurnProjections`.
  - Exposed via `GET /v1/admin/platform-dashboard`.
- **Guided Connector Remediation Service & Endpoint (`connectorRemediationService.ts`, `platformDashboardRouter.ts`):**
  - `POST /v1/admin/connectors/:id/remediate`: Role-gated to `platform_admin`.
  - Guided playbooks:
    1. `retry_now`: Immediate sync attempt, sets status `retrying`.
    2. `override_backoff`: Sets status `active` with configurable `overrideMinutes` and `backoffLiftedUntil`.
    3. `clear_error_state`: Resets failure counters, sets status `healthy`.
    4. `reprompt_credentials`: Marks connector requiring operator credential re-authentication.
  - Automatically records all operational remediation actions in `platform_admin_audit_log` via `logPlatformAdminAction()`.

### 1.2 Frontend (`social-listening-admin`)
- **Core API Client & Types (`core-client.ts`):**
  - Defined `TenantQuotaBurnProjection`, updated `PlatformDashboardData`.
  - Implemented `remediateConnector(connectorId, action, overrideMinutes)` calling core.
- **API Proxy Routes:**
  - `src/app/api/admin/connectors/[id]/remediate/route.ts`
  - `src/app/api/admin/connectors/remediate/route.ts`
- **Quota Velocity & Burn-Rate Forecast Widget (`QuotaBurnRateForecast.tsx`):**
  - Renders risk summary pill counters (`Critical`, `Warning`, `Healthy`).
  - Renders tabular projections showing monthly quota, consumed tokens, 7d velocity, estimated days remaining, projected exhaustion date, and risk badges.
- **Guided Connector Remediation Drawer (`ConnectorRemediationDrawer.tsx`):**
  - Interactive slide-out drawer rendering connector telemetry.
  - Guided playbooks with action buttons (`btn-remediate-retry`, `btn-remediate-override`, `btn-remediate-clear`, `btn-remediate-reprompt`).
  - In-flight loading spinners, feedback alerts, and automatic dashboard telemetry refresh.
- **Operations Dashboard Integration (`PlatformOperationsDashboard.tsx`):**
  - Mounted `QuotaBurnRateForecast` and `ConnectorRemediationDrawer`.
  - Added "🛠 Remediate" action buttons to the connector health table.

---

## 2. Verification Results

### 2.1 Backend Contract Test Suite (`social-listening-core`)
```bash
npm test contracts/epic-16/story-16.4.platform-ops-quota-burn-rate.contract.test.ts
```
**Output:**
```
PASS contracts/epic-16/story-16.4.platform-ops-quota-burn-rate.contract.test.ts (9.189 s)
  Story 16.4 — Platform Ops Quota Burn-Rate Forecasting and Connector Remediation Backend Contract
    AC1: Trailing 7-Day Velocity & Linear Burn-Rate Calculation Engine
      √ accurately computes daily velocity, days remaining, and classifies health status (8 ms)
    AC2: GET /v1/admin/platform-dashboard Exposing Tenant Quota Burn Projections
      √ returns tenantQuotaBurnProjections alongside platform summary metrics (156 ms)
    AC3: Role-Gated Remediation API with Audit Logging
      √ forbids standard tenant users from executing connector remediation playbooks (28 ms)
      √ allows platform_admin to execute override_backoff and records audit entry (44 ms)
      √ allows platform_admin to execute retry_now and clear_error_state playbooks (33 ms)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        9.307 s
```

### 2.2 Frontend Contract Test Suite (`social-listening-admin`)
```bash
npm test contracts/epic-16/story-16.4.platform-ops-quota-burn-rate-ui.contract.test.ts
```
**Output:**
```
PASS contracts/epic-16/story-16.4.platform-ops-quota-burn-rate-ui.contract.test.ts
  Story 16.4 — Platform Operations Quota Burn-Rate Forecasting & Guided Remediation UI Contract
    AC1 & AC2: core-client exports TenantQuotaBurnProjection and remediateConnector
      √ defines TenantQuotaBurnProjection and updates PlatformDashboardData in core-client.ts (18 ms)
      √ exports remediateConnector targeting /v1/admin/connectors/:id/remediate (9 ms)
    AC3: Proxy Route Handler for Connector Remediation
      √ provides remediation proxy route in src/app/api/admin/connectors/ (8 ms)
    AC4: QuotaBurnRateForecast Component
      √ provides QuotaBurnRateForecast component rendering velocity, exhaustion date, and risk badges (11 ms)
    AC5: ConnectorRemediationDrawer Component & Integration
      √ provides ConnectorRemediationDrawer component with guided playbooks (7 ms)
      √ PlatformOperationsDashboard mounts QuotaBurnRateForecast and ConnectorRemediationDrawer (2 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        0.797 s
```

### 2.3 Full Epic 16 Regressions Check
- **`social-listening-core`**: 4 passed, 4 total test suites (31 passed, 31 total tests).
- **`social-listening-admin`**: 1 passed, 1 total test suite (6 passed, 6 total tests); Story 10.7 also verified passing (4 passed, 4 total tests).
- **Typechecks**:
  - `social-listening-core`: `tsc --noEmit` exited 0 with 0 errors.
  - `social-listening-admin`: `tsc --noEmit` exited 0 with 0 errors.

---

## 3. Artifacts Created & Modified
- `social-listening-core/contracts/epic-16/story-16.4.platform-ops-quota-burn-rate.contract.test.ts`
- `social-listening-core/src/platform/quotaBurnRatePredictor.ts`
- `social-listening-core/src/platform/connectorRemediationService.ts`
- `social-listening-core/src/platform/platformMetricsStore.ts`
- `social-listening-core/src/http/versions/v1/platformDashboardRouter.ts`
- `social-listening-core/.claude/skills/platform-operations-dashboard/SKILL.md`
- `social-listening-admin/contracts/epic-16/story-16.4.platform-ops-quota-burn-rate-ui.contract.test.ts`
- `social-listening-admin/src/lib/core-client.ts`
- `social-listening-admin/src/app/api/admin/connectors/[id]/remediate/route.ts`
- `social-listening-admin/src/app/api/admin/connectors/remediate/route.ts`
- `social-listening-admin/src/components/operations/QuotaBurnRateForecast.tsx`
- `social-listening-admin/src/components/operations/ConnectorRemediationDrawer.tsx`
- `social-listening-admin/src/components/operations/PlatformOperationsDashboard.tsx`
- `social-listening-admin/.claude/skills/platform-operations-dashboard/SKILL.md`
- `docs/implementation-plan.md`
- `docs/implementation-plans/Plan-Story-16.4-Platform-Ops-Quota-Burn-Rate.md`
- `docs/walkthroughs/walkthrough-story-16.4.md`
